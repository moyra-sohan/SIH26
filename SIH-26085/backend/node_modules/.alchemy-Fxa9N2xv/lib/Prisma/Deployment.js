import * as Effect from "effect/Effect";
import * as Path from "effect/Path";
import * as Redacted from "effect/Redacted";
import * as Stream from "effect/Stream";
import { deepEqual, isResolved } from "../Diff.js";
import * as Provider from "../Provider.js";
import { DEV_TIMESTAMP, attrOrString, devId, devProvider, } from "./Internal/DevStub.js";
import * as ProviderLayer from "../Local/ProviderLayer.js";
import { Resource } from "../Resource.js";
import { sha256Object } from "../Util/sha256.js";
import { PrismaClient, isNotFound, } from "./Client.js";
import { destroyDeployment, waitForDeploymentStatus, } from "./ComputeLifecycle.js";
import { executeArtifactUpload } from "./Internal/ArtifactUpload.js";
import { aggregateCleanupFailure } from "./Internal/CleanupFailure.js";
import { inspectArtifactFile, readArtifactFile, } from "./Internal/ArtifactFile.js";
import { promoteAppObserved } from "./Internal/AppPromotion.js";
import { startDeploymentIdempotent } from "./Internal/DeploymentActions.js";
import { ensureDeploymentMembership } from "./Internal/DeploymentIdentity.js";
import { observeDeployment } from "./Internal/DeploymentObserve.js";
import { tailDeploymentLogs } from "./PrismaLogs.js";
import { concreteIdsChanged, isInputObject, isPrismaDevId, resolveAppId, unresolvedAppIdOf, } from "./Refs.js";
export const MAX_DEPLOYMENT_ARTIFACT_BYTES = 256 * 1024 * 1024;
/**
 * A Prisma deployment owned by an App.
 *
 * This is the low-level resource: it can upload or reuse an artifact, start it,
 * and promote it, but it does not provide `Prisma.Compute`'s preview/stable
 * health checks or automatic rollback. Prefer `Prisma.Compute` for production
 * application deployments.
 *
 * Prisma's create-deployment API currently exposes neither an idempotency key
 * nor a caller-defined natural key. After a crash that loses state immediately
 * after creation, Alchemy deliberately does not adopt the App's latest
 * deployment: doing so could take ownership of an unrelated deployment. When
 * persisted state contains a Foundry version ID, refresh may safely recover the
 * matching deployment.
 *
 * ### Creating a Deployment
 * **Example:** Fork the currently promoted artifact
 * ```typescript
 * const deployment = yield* Prisma.Deployment("web-v2", {
 *   app: app.appId,
 *   skipCodeUpload: true,
 *   start: true,
 *   promote: true,
 * });
 * ```
 *
 * **Example:** Upload a prebuilt artifact
 * ```typescript
 * const deployment = yield* Prisma.Deployment("web-v3", {
 *   app: app.appId,
 *   artifactPath: "./dist/app.tar.gz",
 *   artifactContentType: "application/gzip",
 *   start: true,
 *   promote: true,
 * });
 * ```
 *
 * @resource
 */
export const Deployment = Resource("Prisma.Deployment");
const findDeployment = (client, appId, foundryVersionId) => foundryVersionId === undefined
    ? Effect.succeed(undefined)
    : client.listAppDeployments(appId, { limit: 100 }).pipe(Effect.flatMap((deployments) => {
        const matches = deployments.filter((deployment) => deployment.foundryVersionId === foundryVersionId);
        return matches.length > 1
            ? Effect.fail(new Error(`Prisma returned multiple deployments with Foundry version ID '${foundryVersionId}' for App '${appId}'; refusing an ambiguous recovery match.`))
            : Effect.succeed(matches[0]);
    }));
const attrsFrom = (deployment, appId, extra) => ({
    deploymentId: deployment.id,
    appId,
    foundryVersionId: deployment.foundryVersionId,
    status: deployment.status,
    previewDomain: deployment.previewDomain,
    artifactHash: extra?.artifactHash,
    triggersHash: extra?.triggersHash,
    appEndpointDomain: extra?.appEndpointDomain,
    createdAt: deployment.createdAt,
});
export function readUploadArtifact(input) {
    return readUploadArtifactInternal(input);
}
const readUploadArtifactInternal = Effect.fn(function* (input) {
    if (input.artifact !== undefined && input.artifactPath !== undefined) {
        return yield* Effect.fail(new Error("artifact and artifactPath are mutually exclusive."));
    }
    if (input.output === "file" && input.artifact !== undefined) {
        return yield* Effect.fail(new Error("File-backed artifact output requires artifactPath."));
    }
    if (input.artifactPath !== undefined) {
        const path = yield* Path.Path;
        const resolved = path.resolve(input.artifactPath);
        const artifact = yield* inspectArtifactFile(resolved, MAX_DEPLOYMENT_ARTIFACT_BYTES);
        if (input.output === "file") {
            return artifact;
        }
        return yield* readArtifactFile(artifact);
    }
    if (input.artifact !== undefined) {
        const artifact = input.artifact;
        const bytes = yield* Effect.sync(() => typeof artifact === "string"
            ? new TextEncoder().encode(artifact)
            : artifact);
        return yield* validateDeploymentArtifactBytes(bytes);
    }
    return undefined;
});
export const validateDeploymentArtifactBytes = (artifact, maxBytes = MAX_DEPLOYMENT_ARTIFACT_BYTES) => !Number.isSafeInteger(maxBytes) || maxBytes <= 0
    ? Effect.fail(new Error("Artifact maxBytes must be a positive safe integer."))
    : maxBytes > MAX_DEPLOYMENT_ARTIFACT_BYTES
        ? Effect.fail(new Error(`Artifact maxBytes must not exceed the hard limit of ${MAX_DEPLOYMENT_ARTIFACT_BYTES}.`))
        : artifact.byteLength === 0
            ? Effect.fail(new Error("Prisma deployment artifact must be non-empty."))
            : artifact.byteLength > maxBytes
                ? Effect.fail(new Error(`Prisma deployment artifact exceeds the ${maxBytes} byte upload safety limit.`))
                : Effect.succeed(artifact);
const artifactHashOf = Effect.fn(function* (props) {
    const artifact = yield* readUploadArtifact({
        artifactPath: props.artifactPath,
        output: "file",
    });
    if (artifact === undefined)
        return undefined;
    return yield* sha256Object({
        artifact: artifact.sha256,
        contentType: props.artifactContentType ?? "application/octet-stream",
    });
});
/**
 * Domain separator so a `triggers` fingerprint is never the bare SHA-256 of
 * a secret value, which would otherwise be comparable against a precomputed
 * digest of a guessed value.
 */
const TRIGGERS_HASH_SALT = "alchemy/Prisma.Deployment/triggers/v1";
const unwrapRedacted = (value) => {
    if (Redacted.isRedacted(value))
        return unwrapRedacted(Redacted.value(value));
    if (Array.isArray(value))
        return value.map(unwrapRedacted);
    if (value !== null && typeof value === "object") {
        return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, unwrapRedacted(item)]));
    }
    return value;
};
const triggersHashOf = (triggers) => sha256Object({
    salt: TRIGGERS_HASH_SALT,
    triggers: unwrapRedacted(triggers) ?? null,
});
const persistedTriggersHash = (value) => (Redacted.isRedacted(value) ? Redacted.value(value) : value);
/**
 * Whether the declared `triggers` inputs differ from the fingerprint the
 * running deployment was created for.
 *
 * Only `diff` can plan a replacement — `reconcile` has no way to ask for one —
 * so an input that is still unresolved while planning is treated as changed.
 * That is only reached when another resource in the same deploy owns the
 * value and is itself changing, in which case the value most likely changed
 * too; the cost of being wrong is one extra create-before-delete replacement.
 * Without a recorded fingerprint there is nothing to compare against, so the
 * first deploy that declares `triggers` records it through the engine's
 * default update instead of replacing the deployment.
 */
const triggersChanged = Effect.fn(function* (triggers, persisted) {
    const recorded = persistedTriggersHash(persisted);
    if (triggers === undefined || recorded === undefined)
        return false;
    if (!isResolved({ triggers }))
        return true;
    return (yield* triggersHashOf(triggers)) !== recorded;
});
export const uploadArtifact = (uploadUrl, artifact, contentType) => Effect.gen(function* () {
    if (artifact instanceof Uint8Array) {
        yield* validateDeploymentArtifactBytes(artifact);
    }
    else if (artifact.size <= 0 ||
        artifact.size > MAX_DEPLOYMENT_ARTIFACT_BYTES) {
        return yield* Effect.fail(new Error(`Prisma deployment artifact exceeds the ${MAX_DEPLOYMENT_ARTIFACT_BYTES} byte upload safety limit.`));
    }
    yield* Effect.try({
        try: () => {
            const parsed = new URL(uploadUrl);
            if (parsed.protocol !== "https:" ||
                parsed.username.length > 0 ||
                parsed.password.length > 0) {
                throw new Error("invalid upload URL");
            }
        },
        catch: () => new Error("Prisma artifact upload URL must be credential-free HTTPS."),
    });
    yield* executeArtifactUpload(uploadUrl, artifact, contentType);
});
const ProviderLive = () => Provider.effect(Deployment, Effect.gen(function* () {
    const client = yield* PrismaClient;
    return {
        stables: ["deploymentId"],
        // App deletion cascades deployments. AppProvider is the single nuke
        // enumerator so a deployment is never deleted twice during teardown.
        list: () => Effect.succeed([]),
        diff: Effect.fn(function* ({ olds, news, output }) {
            if (!isInputObject(news))
                return undefined;
            if (isPrismaDevId(output?.deploymentId)) {
                return { action: "update" };
            }
            // `deploymentId` is stable and Foundry's failed status is terminal.
            // Route drift recovery through the engine's create-before-delete
            // replacement lifecycle instead of trying to restart the failed
            // generation or changing a stable ID during an update.
            if (output?.status === "failed") {
                return { action: "replace" };
            }
            // Checked before the resolved-content early return below: a
            // deferred diff falls back to an update, which reuses the running
            // deployment and would never apply the changed inputs.
            if (yield* triggersChanged(news.triggers, output?.triggersHash)) {
                return { action: "replace" };
            }
            const replacementContent = {
                portMapping: news.portMapping,
                skipCodeUpload: news.skipCodeUpload,
                artifactPath: news.artifactPath,
                artifactContentType: news.artifactContentType,
            };
            if (!isResolved(replacementContent))
                return undefined;
            const resolvedReplacementContent = replacementContent;
            const oldAppId = output?.appId ?? unresolvedAppIdOf(olds.app);
            const newAppId = isResolved(news.app)
                ? unresolvedAppIdOf(news.app)
                : undefined;
            const oldArtifactHash = output?.artifactHash;
            const newArtifactHash = yield* artifactHashOf({
                app: olds.app,
                ...resolvedReplacementContent,
            });
            const appChanged = concreteIdsChanged(oldAppId, newAppId);
            if (appChanged ||
                !deepEqual(resolvedReplacementContent.portMapping ?? {}, olds.portMapping ?? {}) ||
                (resolvedReplacementContent.skipCodeUpload ?? false) !==
                    (olds.skipCodeUpload ?? false) ||
                resolvedReplacementContent.artifactPath !== olds.artifactPath ||
                resolvedReplacementContent.artifactContentType !==
                    olds.artifactContentType ||
                (newArtifactHash !== undefined &&
                    newArtifactHash !== oldArtifactHash)) {
                return { action: "replace" };
            }
            const updateProps = {
                start: news.start,
                promote: news.promote,
            };
            if (!isResolved(updateProps))
                return undefined;
            const resolvedUpdateProps = updateProps;
            if ((resolvedUpdateProps.start ?? false) ||
                (resolvedUpdateProps.promote ?? false)) {
                // Reconcile asserted lifecycle state on every deploy so external
                // stops and App routing drift are repaired.
                return { action: "update" };
            }
            if ((resolvedUpdateProps.start ?? false) !== (olds.start ?? false) ||
                (resolvedUpdateProps.promote ?? false) !== (olds.promote ?? false)) {
                return { action: "update" };
            }
            return undefined;
        }),
        read: Effect.fn(function* ({ output, olds }) {
            if (isPrismaDevId(output?.deploymentId))
                return undefined;
            const appId = output?.appId && !isPrismaDevId(output.appId)
                ? output.appId
                : yield* resolveAppId(olds.app);
            const savedDeployment = output?.deploymentId
                ? yield* observeDeployment(client, output.deploymentId).pipe(Effect.catchIf(isNotFound, () => Effect.succeed(undefined)))
                : undefined;
            const listed = savedDeployment
                ? undefined
                : yield* findDeployment(client, appId, output?.foundryVersionId);
            const deployment = savedDeployment ??
                (listed ? yield* observeDeployment(client, listed.id) : undefined);
            if (savedDeployment) {
                yield* ensureDeploymentMembership(client, appId, savedDeployment);
            }
            return deployment ? attrsFrom(deployment, appId, output) : undefined;
        }),
        reconcile: Effect.fn(function* ({ news, output }) {
            if (news.portMapping?.http !== undefined &&
                news.portMapping.http !== null &&
                (!Number.isInteger(news.portMapping.http) ||
                    news.portMapping.http < 1 ||
                    news.portMapping.http > 65_535)) {
                return yield* Effect.fail(new Error("portMapping.http must be an integer between 1 and 65535."));
            }
            if (!(news.skipCodeUpload ?? false) &&
                news.artifactPath === undefined) {
                return yield* Effect.fail(new Error("Prisma.Deployment requires artifactPath or skipCodeUpload: true."));
            }
            if ((news.skipCodeUpload ?? false) &&
                news.artifactPath !== undefined) {
                return yield* Effect.fail(new Error("skipCodeUpload cannot be combined with artifactPath."));
            }
            if ((news.promote ?? false) && news.start === false) {
                return yield* Effect.fail(new Error("promote cannot be combined with start: false."));
            }
            const artifact = yield* readUploadArtifact({
                artifactPath: news.artifactPath,
                output: "file",
            });
            const artifactHash = artifact === undefined
                ? output?.artifactHash
                : yield* sha256Object({
                    artifact: artifact.sha256,
                    contentType: news.artifactContentType ?? "application/octet-stream",
                });
            const triggersHash = news.triggers === undefined
                ? undefined
                : Redacted.make(yield* triggersHashOf(news.triggers));
            const appId = yield* resolveAppId(news.app);
            const deploymentId = isPrismaDevId(output?.deploymentId)
                ? undefined
                : output?.deploymentId;
            let deployment = deploymentId
                ? yield* observeDeployment(client, deploymentId).pipe(Effect.catchIf(isNotFound, () => Effect.succeed(undefined)))
                : undefined;
            if (deployment) {
                yield* ensureDeploymentMembership(client, appId, deployment);
                if (deployment.status === "failed") {
                    return yield* Effect.fail(new Error(`Prisma deployment '${deployment.id}' is in terminal status 'failed' and must be replaced before reconcile; refusing to restart it or change the stable deploymentId during an update.`));
                }
            }
            let createdDeploymentId;
            const cleanupCreatedDeploymentOnFailure = (failedDeploymentId, error) => createdDeploymentId === failedDeploymentId
                ? destroyDeployment(client, failedDeploymentId).pipe(Effect.catch((cleanupError) => Effect.fail(aggregateCleanupFailure("deployment", failedDeploymentId, `/v1/deployments/${failedDeploymentId}`, error, cleanupError))), Effect.andThen(() => Effect.fail(error)))
                : Effect.fail(error);
            if (!deployment) {
                const created = yield* client.createAppDeployment(appId, {
                    portMapping: news.portMapping,
                    skipCodeUpload: news.skipCodeUpload,
                });
                createdDeploymentId = created.id;
                if (artifact !== undefined && !created.uploadUrl) {
                    return yield* cleanupCreatedDeploymentOnFailure(created.id, new Error("Prisma deployment creation did not return an upload URL."));
                }
                if (created.uploadUrl && artifact !== undefined) {
                    yield* uploadArtifact(created.uploadUrl, artifact, news.artifactContentType ?? "application/octet-stream").pipe(Effect.catch((error) => cleanupCreatedDeploymentOnFailure(created.id, error)));
                }
                deployment = yield* observeDeployment(client, created.id).pipe(Effect.catchIf(isNotFound, () => Effect.succeed({
                    id: created.id,
                    type: "deployment",
                    url: created.url,
                    foundryVersionId: created.foundryVersionId,
                    status: "new",
                    previewDomain: null,
                    createdAt: undefined,
                })), Effect.catch((error) => cleanupCreatedDeploymentOnFailure(created.id, error)));
            }
            if (!deployment) {
                return yield* Effect.fail(new Error("Prisma deployment could not be resolved after creation."));
            }
            let appEndpointDomain = output?.appEndpointDomain;
            const shouldStart = news.start ?? news.promote ?? false;
            if (shouldStart) {
                const currentDeployment = deployment;
                const currentDeploymentId = currentDeployment.id;
                deployment = yield* Effect.gen(function* () {
                    if (currentDeployment.status !== "running" &&
                        currentDeployment.status !== "provisioning") {
                        const started = yield* startDeploymentIdempotent(client, currentDeployment.id);
                        if (started) {
                            return yield* waitForDeploymentStatus(client, currentDeployment.id, "running").pipe(Effect.map((running) => ({
                                ...running,
                                previewDomain: started.previewDomain,
                            })));
                        }
                    }
                    return yield* waitForDeploymentStatus(client, currentDeployment.id, "running");
                }).pipe(Effect.catch((error) => cleanupCreatedDeploymentOnFailure(currentDeploymentId, error)));
            }
            if (news.promote ?? false) {
                appEndpointDomain = yield* Effect.gen(function* () {
                    // Promotion is deliberately replayed even when the control-plane
                    // record already names this deployment. The endpoint operation also
                    // repairs provider routing and custom-domain assignment drift.
                    const promoted = yield* promoteAppObserved(client, appId, deployment.id);
                    return promoted.appEndpointDomain;
                });
            }
            return attrsFrom(deployment, appId, {
                artifactHash,
                triggersHash,
                appEndpointDomain,
            });
        }),
        delete: Effect.fn(function* ({ output }) {
            if (isPrismaDevId(output.deploymentId))
                return;
            const deployment = yield* observeDeployment(client, output.deploymentId).pipe(Effect.catchIf(isNotFound, () => Effect.succeed(undefined)));
            if (!deployment)
                return;
            yield* ensureDeploymentMembership(client, output.appId, deployment);
            yield* destroyDeployment(client, output.deploymentId);
        }),
        tail: ({ output }) => output.deploymentId
            ? tailDeploymentLogs(client, output.deploymentId)
            : Stream.empty,
    };
}));
const ProviderLocal = () => devProvider(Deployment, ["deploymentId"], ({ id, news }) => ({
    deploymentId: devId("deployment", id),
    appId: attrOrString(news.app, "appId"),
    foundryVersionId: devId("foundry-version", id),
    status: "new",
    previewDomain: undefined,
    artifactHash: undefined,
    triggersHash: undefined,
    appEndpointDomain: undefined,
    createdAt: DEV_TIMESTAMP,
}));
export const DeploymentProvider = () => ProviderLayer.dual(Deployment, {
    local: () => ProviderLocal(),
    live: () => ProviderLive(),
});
//# sourceMappingURL=Deployment.js.map