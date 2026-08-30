import * as analytics from "@distilled.cloud/aws/kinesis-analytics-v2";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Schedule from "effect/Schedule";
import { isResolved } from "../../Diff.js";
import { createPhysicalName } from "../../PhysicalName.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
/**
 * A snapshot (Flink savepoint) of a running Managed Service for Apache
 * Flink application's state.
 *
 * Snapshots are immutable — every prop change replaces the snapshot. The
 * source application must be `RUNNING` with `snapshotsEnabled: true` when
 * the snapshot is created.
 * ### Creating Snapshots
 * **Example:** Snapshot a running application
 * ```typescript
 * import * as AWS from "alchemy/AWS";
 *
 * const app = yield* AWS.KinesisAnalyticsV2.Application("Enrichment", {
 *   runtimeEnvironment: "FLINK-1_20",
 *   code: { bucketArn: bucket.bucketArn, fileKey: "jobs/enrichment-1.0.jar" },
 *   snapshotsEnabled: true,
 *   start: true,
 * });
 * const snapshot = yield* AWS.KinesisAnalyticsV2.ApplicationSnapshot(
 *   "Checkpoint",
 *   { applicationName: app.applicationName },
 * );
 * ```
 *
 * @resource
 */
export const ApplicationSnapshot = Resource("AWS.KinesisAnalyticsV2.ApplicationSnapshot");
/**
 * The snapshot entered `FAILED` (or vanished) while waiting for `READY`.
 */
export class SnapshotFailed extends Data.TaggedError("SnapshotFailed") {
}
class SnapshotPending extends Data.TaggedError("SnapshotPending") {
}
class SnapshotStillExists extends Data.TaggedError("SnapshotStillExists") {
}
const createSnapshotName = (id, props) => Effect.gen(function* () {
    if (props.snapshotName) {
        return props.snapshotName;
    }
    return yield* createPhysicalName({ id, maxLength: 256 });
});
/**
 * Retries `ResourceInUseException` (the application is transitioning, e.g.
 * an update settling before the snapshot can start) on a bounded schedule.
 * Explicit return annotation for the declaration-emit reason documented in
 * `Application.ts`.
 */
const retryWhileInUse = (self) => Effect.retry(self, {
    while: (e) => e._tag === "ResourceInUseException",
    schedule: Schedule.max([Schedule.fixed("2 seconds"), Schedule.recurs(30)]),
});
const describeSnapshot = Effect.fn(function* ({ applicationName, snapshotName, }) {
    const response = yield* analytics
        .describeApplicationSnapshot({
        ApplicationName: applicationName,
        SnapshotName: snapshotName,
    })
        .pipe(Effect.catchTag("ResourceNotFoundException", () => Effect.succeed(undefined)));
    return response?.SnapshotDetails;
});
// Snapshot creation is proportional to state size; small test jobs finish
// in seconds. 5s × 36 bounds the wait at 180s.
const waitForSnapshotReady = ({ applicationName, snapshotName, }) => Effect.gen(function* () {
    const details = yield* describeSnapshot({ applicationName, snapshotName });
    const status = details?.SnapshotStatus ?? "MISSING";
    if (status === "READY") {
        return details;
    }
    if (status === "CREATING") {
        return yield* Effect.fail(new SnapshotPending({ status }));
    }
    return yield* Effect.fail(new SnapshotFailed({ applicationName, snapshotName, status }));
}).pipe(Effect.retry({
    while: (e) => e._tag === "SnapshotPending",
    schedule: Schedule.max([
        Schedule.fixed("5 seconds"),
        Schedule.recurs(36),
    ]),
}), Effect.catchTag("SnapshotPending", (e) => Effect.fail(new SnapshotFailed({ applicationName, snapshotName, status: e.status }))));
const waitForSnapshotDeleted = ({ applicationName, snapshotName, }) => Effect.gen(function* () {
    const details = yield* describeSnapshot({ applicationName, snapshotName });
    if (details !== undefined) {
        return yield* Effect.fail(new SnapshotStillExists());
    }
}).pipe(Effect.retry({
    while: (e) => e._tag === "SnapshotStillExists",
    schedule: Schedule.max([
        Schedule.fixed("3 seconds"),
        Schedule.recurs(30),
    ]),
}));
export const ApplicationSnapshotProvider = () => Provider.effect(ApplicationSnapshot, Effect.gen(function* () {
    return ApplicationSnapshot.Provider.of({
        stables: ["applicationName", "snapshotName", "applicationVersionId"],
        // Sub-resource keyed by its parent application — snapshots are not
        // enumerable account-wide, so `list` is empty and refresh flows
        // through `read` on known instances.
        list: () => Effect.succeed([]),
        read: Effect.fn(function* ({ id, olds, output }) {
            const applicationName = output?.applicationName ?? olds?.applicationName;
            if (!applicationName)
                return undefined;
            const snapshotName = output?.snapshotName ?? (yield* createSnapshotName(id, olds ?? {}));
            const details = yield* describeSnapshot({
                applicationName,
                snapshotName,
            });
            if (!details)
                return undefined;
            return {
                applicationName,
                snapshotName,
                snapshotStatus: details.SnapshotStatus,
                applicationVersionId: details.ApplicationVersionId,
            };
        }),
        diff: Effect.fn(function* ({ id, news, olds }) {
            if (!isResolved(news))
                return undefined;
            // Snapshots are immutable — any identity change replaces.
            const oldName = yield* createSnapshotName(id, olds ?? {});
            const newName = yield* createSnapshotName(id, news ?? {});
            if (olds?.applicationName !== news?.applicationName ||
                oldName !== newName) {
                return { action: "replace" };
            }
        }),
        // Existence-only resource: observe → if missing, create → wait for
        // READY. Nothing about a snapshot is mutable.
        reconcile: Effect.fn(function* ({ id, news, output, session }) {
            const applicationName = news.applicationName;
            const snapshotName = output?.snapshotName ?? (yield* createSnapshotName(id, news));
            const observed = yield* describeSnapshot({
                applicationName,
                snapshotName,
            });
            if (observed === undefined) {
                yield* retryWhileInUse(analytics.createApplicationSnapshot({
                    ApplicationName: applicationName,
                    SnapshotName: snapshotName,
                }));
                yield* session.note(`Creating snapshot ${snapshotName}...`);
            }
            const ready = yield* waitForSnapshotReady({
                applicationName,
                snapshotName,
            });
            yield* session.note(snapshotName);
            return {
                applicationName,
                snapshotName,
                snapshotStatus: ready.SnapshotStatus,
                applicationVersionId: ready.ApplicationVersionId,
            };
        }),
        delete: Effect.fn(function* ({ output }) {
            // DeleteApplicationSnapshot requires the snapshot's creation
            // timestamp — observe it fresh. A missing snapshot (or a missing
            // application) means the delete already happened.
            const details = yield* describeSnapshot({
                applicationName: output.applicationName,
                snapshotName: output.snapshotName,
            });
            if (!details?.SnapshotCreationTimestamp) {
                return;
            }
            yield* retryWhileInUse(analytics
                .deleteApplicationSnapshot({
                ApplicationName: output.applicationName,
                SnapshotName: output.snapshotName,
                SnapshotCreationTimestamp: details.SnapshotCreationTimestamp,
            })
                .pipe(Effect.catchTag("ResourceNotFoundException", () => Effect.void)));
            yield* waitForSnapshotDeleted({
                applicationName: output.applicationName,
                snapshotName: output.snapshotName,
            });
        }),
    });
}));
//# sourceMappingURL=ApplicationSnapshot.js.map