import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import { isConflict, isNotFound, PrismaApiError, } from "./Client.js";
import { stopDeploymentIdempotent } from "./Internal/DeploymentActions.js";
import { observeDeployment } from "./Internal/DeploymentObserve.js";
export { isConflict } from "./Client.js";
const DEFAULT_TIMEOUT_SECONDS = 120;
const DEFAULT_POLL_INTERVAL_MS = 1_000;
const DELETE_CONFLICT_RETRY_ATTEMPTS = 5;
const deleteRetryDelay = (attempt) => Effect.sleep(Duration.millis(250 * 2 ** attempt));
const ensureError = (error) => error instanceof Error
    ? error
    : new Error("Prisma deployment lifecycle operation failed.", {
        cause: error,
    });
const isProjectDeleteBlocked = (error) => isConflict(error) ||
    (error instanceof PrismaApiError &&
        error.method === "DELETE" &&
        error.path.startsWith("/v1/projects/") &&
        error.status === 400);
const deploymentDeleteFailed = (deploymentId, statusAtDelete, error) => {
    const format = (error) => error instanceof PrismaApiError
        ? `Prisma API returned HTTP ${error.status}: ${error.message}`
        : error instanceof Error
            ? error.message
            : String(error);
    const detail = format(error);
    const isKnownStoppedDeleteFailure = statusAtDelete === "stopped" &&
        error instanceof PrismaApiError &&
        error.status >= 500;
    return new Error([
        `Failed to delete Prisma deployment '${deploymentId}' while it was in status '${statusAtDelete ?? "unknown"}'.`,
        detail,
        isKnownStoppedDeleteFailure
            ? "Stopped Prisma deployments are expected to be deletable; the Management API returned a server error."
            : undefined,
        "The deployment may need platform cleanup before the App or project can be deleted.",
        `Manual check: GET /v1/deployments/${deploymentId}; manual retry: DELETE /v1/deployments/${deploymentId}.`,
    ]
        .filter((line) => line !== undefined)
        .join(" "), { cause: error });
};
const deploymentWaitTimedOut = (deploymentId, targetStatus, lastStatus) => new Error(`Timed out waiting for Prisma deployment '${deploymentId}' to reach '${targetStatus}' (last status: '${lastStatus ?? "unknown"}')`);
export const waitForDeploymentStatus = Effect.fn(function* (client, deploymentId, targetStatus, options = {}) {
    const timeoutSeconds = options.timeoutSeconds ?? DEFAULT_TIMEOUT_SECONDS;
    const intervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    if (!Number.isFinite(timeoutSeconds) || timeoutSeconds <= 0) {
        return yield* Effect.fail(new Error("timeoutSeconds must be a positive finite number."));
    }
    if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
        return yield* Effect.fail(new Error("pollIntervalMs must be a positive finite number."));
    }
    const timeoutMs = timeoutSeconds * 1_000;
    const startedAt = yield* Effect.sync(() => Date.now());
    const deadline = startedAt + timeoutMs;
    let lastStatus;
    while (true) {
        const remainingBeforeObservation = yield* Effect.sync(() => deadline - Date.now());
        if (remainingBeforeObservation <= 0) {
            return yield* Effect.fail(deploymentWaitTimedOut(deploymentId, targetStatus, lastStatus));
        }
        const deploymentOption = yield* observeDeployment(client, deploymentId).pipe(Effect.timeoutOption(Duration.millis(remainingBeforeObservation)));
        if (Option.isNone(deploymentOption)) {
            return yield* Effect.fail(deploymentWaitTimedOut(deploymentId, targetStatus, lastStatus));
        }
        const deployment = deploymentOption.value;
        lastStatus = deployment.status;
        if (deployment.status === targetStatus) {
            return deployment;
        }
        if (deployment.status === "failed") {
            return yield* Effect.fail(new Error(`Prisma deployment '${deploymentId}' failed`));
        }
        const elapsed = yield* Effect.sync(() => Date.now() - startedAt);
        if (elapsed >= timeoutMs) {
            return yield* Effect.fail(deploymentWaitTimedOut(deploymentId, targetStatus, lastStatus));
        }
        yield* Effect.sleep(Duration.millis(Math.min(intervalMs, timeoutMs - elapsed)));
    }
});
/**
 * Stops a running or provisioning deployment, then deletes it.
 *
 * Uses the canonical deployment lifecycle routes. Errors include the observed
 * status and exact manual route for cleanup.
 */
export const destroyDeployment = Effect.fn(function* (client, deploymentId, options = {}) {
    const deployment = yield* observeDeployment(client, deploymentId).pipe(Effect.catchIf(isNotFound, () => Effect.succeed(undefined)));
    if (!deployment) {
        return {
            deploymentId,
            previousStatus: undefined,
            stopped: false,
            // The postcondition is already satisfied. Report this consistently
            // with delete calls whose 404 is observed after cleanup starts.
            deleted: true,
        };
    }
    const previousStatus = deployment.status;
    let statusAtDelete = previousStatus;
    let stopped = false;
    if (deployment.status === "running" ||
        deployment.status === "provisioning") {
        yield* stopDeploymentIdempotent(client, deploymentId).pipe(Effect.catchIf((e) => isNotFound(e), () => Effect.void), Effect.mapError(ensureError));
        const stoppedVersion = yield* waitForDeploymentStatus(client, deploymentId, "stopped", options).pipe(Effect.catchIf(isNotFound, () => Effect.succeed(undefined)));
        statusAtDelete = stoppedVersion?.status ?? "stopped";
        stopped = true;
    }
    yield* client.deleteDeployment(deploymentId).pipe(Effect.catchIf(isNotFound, () => Effect.void), Effect.catch((error) => Effect.fail(deploymentDeleteFailed(deploymentId, statusAtDelete, error))));
    return {
        deploymentId,
        previousStatus,
        stopped,
        deleted: true,
    };
});
/**
 * Deletes an App. The canonical App delete endpoint cascades its deployments.
 */
export const destroyApp = Effect.fn(function* (client, appId, options = {}) {
    let appDeleted = false;
    if (!options.keepApp) {
        for (let attempt = 0; attempt < DELETE_CONFLICT_RETRY_ATTEMPTS; attempt++) {
            const deleted = yield* client.deleteApp(appId).pipe(Effect.as(true), Effect.catchIf(isNotFound, () => Effect.succeed(true)), Effect.catchIf(isConflict, (error) => attempt + 1 < DELETE_CONFLICT_RETRY_ATTEMPTS
                ? deleteRetryDelay(attempt).pipe(Effect.as(false))
                : Effect.fail(error)));
            if (deleted) {
                appDeleted = true;
                break;
            }
        }
    }
    return {
        appId,
        appDeleted,
    };
});
/**
 * Deletes every App under a project, then deletes the project.
 *
 * Callers can start from the project ID and let Alchemy discover the App IDs.
 */
export const destroyProjectApps = Effect.fn(function* (client, projectId, options = {}) {
    const deletedAppIds = new Set();
    const cleanupApps = Effect.fn(function* () {
        const apps = yield* client
            .listApps({
            projectId,
            limit: 100,
        })
            .pipe(Effect.catchIf(isNotFound, () => Effect.succeed(undefined)));
        if (!apps)
            return false;
        for (const app of apps) {
            const result = yield* destroyApp(client, app.id, options);
            if (result.appDeleted)
                deletedAppIds.add(app.id);
        }
        return true;
    });
    yield* cleanupApps();
    let projectDeleted = false;
    if (!options.keepProject) {
        for (let attempt = 0; attempt < DELETE_CONFLICT_RETRY_ATTEMPTS; attempt++) {
            const deleted = yield* client.deleteProject(projectId).pipe(Effect.as(true), Effect.catchIf(isNotFound, () => Effect.succeed(true)), Effect.catchIf(isProjectDeleteBlocked, (error) => attempt + 1 < DELETE_CONFLICT_RETRY_ATTEMPTS
                ? cleanupApps().pipe(Effect.andThen(deleteRetryDelay(attempt)), Effect.as(false))
                : Effect.fail(error)));
            if (deleted) {
                projectDeleted = true;
                break;
            }
        }
    }
    return {
        projectId,
        deletedAppIds: Array.from(deletedAppIds),
        projectDeleted,
    };
});
export const toDeploymentUrl = (domain) => domain
    ? domain.startsWith("http://") || domain.startsWith("https://")
        ? domain
        : `https://${domain}`
    : undefined;
//# sourceMappingURL=ComputeLifecycle.js.map