import * as docdb from "@distilled.cloud/aws/docdb";
import * as Effect from "effect/Effect";
import * as Schedule from "effect/Schedule";
import * as Stream from "effect/Stream";
import { isResolved } from "../../Diff.js";
import { createPhysicalName } from "../../PhysicalName.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
import { createInternalTags, diffTags } from "../../Tags.js";
/**
 * An Amazon DocumentDB instance — a compute member of a DocumentDB
 * {@link DBCluster}. Storage, backup, and endpoints are managed at the cluster
 * level; the instance contributes CPU/RAM and can serve as a writer or reader.
 * Provisioning takes several minutes.
 *
 * Mutable fields (`dbInstanceClass`, `promotionTier`, maintenance window,
 * monitoring) are reconciled in place; immutable fields (`engine`,
 * `dbClusterIdentifier`, `availabilityZone`) force a replacement.
 * ### Adding an Instance
 * **Example:** A DocumentDB writer instance
 * ```typescript
 * const writer = yield* DBInstance("Writer", {
 *   dbClusterIdentifier: cluster.dbClusterIdentifier,
 *   dbInstanceClass: "db.t3.medium",
 * });
 * ```
 *
 * @resource
 */
export const DBInstance = Resource("AWS.DocDB.DBInstance");
const toTagRecord = (tags) => Object.fromEntries((tags ?? [])
    .filter((tag) => typeof tag.Key === "string" && typeof tag.Value === "string")
    .map((tag) => [tag.Key, tag.Value]));
const toAttrs = ({ instance, tags, }) => ({
    dbInstanceIdentifier: instance.DBInstanceIdentifier ?? "",
    dbInstanceArn: instance.DBInstanceArn ?? "",
    dbClusterIdentifier: instance.DBClusterIdentifier,
    endpointAddress: instance.Endpoint?.Address,
    endpointPort: instance.Endpoint?.Port,
    dbInstanceClass: instance.DBInstanceClass,
    engine: instance.Engine,
    engineVersion: instance.EngineVersion,
    status: instance.DBInstanceStatus,
    promotionTier: instance.PromotionTier,
    publiclyAccessible: instance.PubliclyAccessible,
    dbSubnetGroupName: instance.DBSubnetGroup?.DBSubnetGroupName,
    availabilityZone: instance.AvailabilityZone,
    preferredMaintenanceWindow: instance.PreferredMaintenanceWindow,
    backupRetentionPeriod: instance.BackupRetentionPeriod,
    kmsKeyId: instance.KmsKeyId,
    storageEncrypted: instance.StorageEncrypted,
    caCertificateIdentifier: instance.CACertificateIdentifier,
    performanceInsightsEnabled: instance.PerformanceInsightsEnabled,
    enabledCloudwatchLogsExports: instance.EnabledCloudwatchLogsExports ?? [],
    dbiResourceId: instance.DbiResourceId,
    autoMinorVersionUpgrade: instance.AutoMinorVersionUpgrade,
    copyTagsToSnapshot: instance.CopyTagsToSnapshot,
    tags,
});
export const DBInstanceProvider = () => Provider.effect(DBInstance, Effect.gen(function* () {
    const toIdentifier = (id, props) => props.dbInstanceIdentifier
        ? Effect.succeed(props.dbInstanceIdentifier)
        : createPhysicalName({ id, maxLength: 63 });
    const readInstance = Effect.fn(function* (instanceId) {
        const response = yield* docdb
            .describeDBInstances({
            DBInstanceIdentifier: instanceId,
        })
            .pipe(Effect.catchTag("DBInstanceNotFoundFault", () => Effect.succeed(undefined)));
        return response?.DBInstances?.[0];
    });
    const readTags = Effect.fn(function* (arn) {
        if (!arn)
            return {};
        const response = yield* docdb
            .listTagsForResource({ ResourceName: arn })
            .pipe(Effect.catchTag("DBInstanceNotFoundFault", () => Effect.succeed(undefined)));
        return toTagRecord(response?.TagList);
    });
    // Bounded readiness wait. Gate on `DBInstanceStatus === "available"` so a
    // follow-on `modifyDBInstance` doesn't hit `InvalidDBInstanceStateFault`.
    // Budgets ~10 min (60 * 10s) for slow provisioning.
    const waitForInstance = Effect.fn(function* (instanceId) {
        const readinessPolicy = Schedule.max([
            Schedule.fixed("10 seconds"),
            Schedule.recurs(60),
        ]);
        return yield* readInstance(instanceId).pipe(Effect.flatMap((instance) => {
            if (!instance?.DBInstanceArn) {
                return Effect.fail(new Error(`DB instance '${instanceId}' not found`));
            }
            const status = instance.DBInstanceStatus;
            if (status !== "available" &&
                status !== "incompatible-parameters" &&
                status !== "incompatible-restore") {
                return Effect.fail(new Error(`DB instance '${instanceId}' not available (status: ${status})`));
            }
            return Effect.succeed(instance);
        }), Effect.retry({ schedule: readinessPolicy }));
    });
    return {
        stables: ["dbInstanceArn", "dbInstanceIdentifier"],
        // AWS account/region collection: `describeDBInstances` is paginated
        // (items: "DBInstances"). DocumentDB does not surface tags inline, so
        // we emit an empty tag map rather than a per-item `listTagsForResource`
        // fan-out. `DBInstanceNotFoundFault` is in the op's typed error union;
        // treat a stray one as "nothing to list".
        list: () => docdb.describeDBInstances.pages({}).pipe(Stream.runCollect, Effect.map((chunk) => Array.from(chunk).flatMap((page) => (page.DBInstances ?? [])
            .filter((instance) => instance.DBInstanceArn != null)
            .map((instance) => toAttrs({ instance, tags: {} })))), Effect.catchTag("DBInstanceNotFoundFault", () => Effect.succeed([]))),
        diff: Effect.fn(function* ({ id, olds, news }) {
            if (!isResolved(news))
                return undefined;
            if ((yield* toIdentifier(id, olds ?? {})) !==
                (yield* toIdentifier(id, news))) {
                return { action: "replace" };
            }
            // Immutable props — any change forces a fresh instance.
            if (olds !== undefined &&
                ((olds.engine ?? "docdb") !== (news.engine ?? "docdb") ||
                    olds.dbClusterIdentifier !== news.dbClusterIdentifier ||
                    olds.availabilityZone !== news.availabilityZone)) {
                return { action: "replace" };
            }
        }),
        read: Effect.fn(function* ({ id, olds, output }) {
            const identifier = output?.dbInstanceIdentifier ??
                (yield* toIdentifier(id, olds ??
                    {
                        dbClusterIdentifier: "",
                        dbInstanceClass: "",
                    }));
            const instance = yield* readInstance(identifier);
            if (!instance?.DBInstanceArn) {
                return undefined;
            }
            const tags = yield* readTags(instance.DBInstanceArn);
            return toAttrs({ instance, tags });
        }),
        reconcile: Effect.fn(function* ({ id, news, output, session }) {
            const identifier = output?.dbInstanceIdentifier ?? (yield* toIdentifier(id, news));
            const internalTags = yield* createInternalTags(id);
            const desiredTags = { ...internalTags, ...news.tags };
            // Observe — fetch live instance state.
            let observed = yield* readInstance(identifier);
            // Ensure — create if missing. Tolerate
            // `DBInstanceAlreadyExistsFault` as a race with a peer reconciler.
            if (!observed?.DBInstanceArn) {
                yield* docdb
                    .createDBInstance({
                    DBInstanceIdentifier: identifier,
                    DBClusterIdentifier: news.dbClusterIdentifier,
                    DBInstanceClass: news.dbInstanceClass,
                    Engine: news.engine ?? "docdb",
                    AvailabilityZone: news.availabilityZone,
                    PreferredMaintenanceWindow: news.preferredMaintenanceWindow,
                    AutoMinorVersionUpgrade: news.autoMinorVersionUpgrade,
                    PromotionTier: news.promotionTier,
                    EnablePerformanceInsights: news.enablePerformanceInsights,
                    PerformanceInsightsKMSKeyId: news.performanceInsightsKMSKeyId,
                    CACertificateIdentifier: news.caCertificateIdentifier,
                    CopyTagsToSnapshot: news.copyTagsToSnapshot,
                    Tags: Object.entries(desiredTags).map(([Key, Value]) => ({
                        Key,
                        Value,
                    })),
                })
                    .pipe(Effect.catchTag("DBInstanceAlreadyExistsFault", () => Effect.void));
                observed = yield* waitForInstance(identifier);
            }
            else {
                // Wait for the instance to settle before any modify so the call
                // doesn't hit `InvalidDBInstanceStateFault`.
                observed = yield* waitForInstance(identifier);
                // syncCoreSettings — single `modifyDBInstance` carrying scalar
                // in-place fields. Only emit a field when the desired value differs
                // from the observed cloud state.
                const core = {
                    DBInstanceIdentifier: identifier,
                    ApplyImmediately: true,
                };
                let coreDirty = false;
                const setIf = (key, desired, observedValue) => {
                    if (desired !== undefined && desired !== observedValue) {
                        core[key] = desired;
                        coreDirty = true;
                    }
                };
                setIf("DBInstanceClass", news.dbInstanceClass, observed.DBInstanceClass); // prettier-ignore
                setIf("PreferredMaintenanceWindow", news.preferredMaintenanceWindow, observed.PreferredMaintenanceWindow); // prettier-ignore
                setIf("AutoMinorVersionUpgrade", news.autoMinorVersionUpgrade, observed.AutoMinorVersionUpgrade); // prettier-ignore
                setIf("PromotionTier", news.promotionTier, observed.PromotionTier);
                setIf("EnablePerformanceInsights", news.enablePerformanceInsights, observed.PerformanceInsightsEnabled); // prettier-ignore
                setIf("PerformanceInsightsKMSKeyId", news.performanceInsightsKMSKeyId, observed.PerformanceInsightsKMSKeyId); // prettier-ignore
                setIf("CACertificateIdentifier", news.caCertificateIdentifier, observed.CACertificateIdentifier); // prettier-ignore
                setIf("CopyTagsToSnapshot", news.copyTagsToSnapshot, observed.CopyTagsToSnapshot); // prettier-ignore
                if (coreDirty) {
                    yield* docdb.modifyDBInstance(core);
                    observed = yield* waitForInstance(identifier);
                }
            }
            const dbInstanceArn = observed.DBInstanceArn ?? "";
            // Sync tags — diff observed cloud tags against desired.
            const observedTags = yield* readTags(dbInstanceArn);
            const { removed, upsert } = diffTags(observedTags, desiredTags);
            if (upsert.length > 0 && dbInstanceArn) {
                yield* docdb.addTagsToResource({
                    ResourceName: dbInstanceArn,
                    Tags: upsert,
                });
            }
            if (removed.length > 0 && dbInstanceArn) {
                yield* docdb.removeTagsFromResource({
                    ResourceName: dbInstanceArn,
                    TagKeys: removed,
                });
            }
            yield* session.note(dbInstanceArn || identifier);
            return toAttrs({ instance: observed, tags: desiredTags });
        }),
        delete: Effect.fn(function* ({ output }) {
            yield* docdb
                .deleteDBInstance({
                DBInstanceIdentifier: output.dbInstanceIdentifier,
            })
                .pipe(Effect.catchTag("DBInstanceNotFoundFault", () => Effect.void));
            // Block until the instance is fully gone so a dependent cluster or
            // subnet group is not torn down while DocumentDB still references it.
            yield* Effect.repeat(docdb
                .describeDBInstances({
                DBInstanceIdentifier: output.dbInstanceIdentifier,
            })
                .pipe(Effect.as(true), Effect.catchTag("DBInstanceNotFoundFault", () => Effect.succeed(false))), {
                schedule: Schedule.max([
                    Schedule.fixed("15 seconds"),
                    Schedule.recurs(40),
                ]),
                until: (exists) => exists === false,
            }).pipe(Effect.catch(() => Effect.void));
        }),
    };
}));
//# sourceMappingURL=DBInstance.js.map