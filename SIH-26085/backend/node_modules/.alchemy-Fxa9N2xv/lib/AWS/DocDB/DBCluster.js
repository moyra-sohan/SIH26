import * as docdb from "@distilled.cloud/aws/docdb";
import * as Effect from "effect/Effect";
import * as Schedule from "effect/Schedule";
import * as Stream from "effect/Stream";
import { isResolved } from "../../Diff.js";
import { createPhysicalName } from "../../PhysicalName.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
import { toWireDays } from "../../Util/Duration.js";
import { createInternalTags, diffTags } from "../../Tags.js";
/**
 * An Amazon DocumentDB (MongoDB-compatible) cluster.
 *
 * `DBCluster` owns the writer and reader endpoints and cluster-wide
 * networking; instances are added via {@link DBInstance}. It can bootstrap
 * master credentials directly or let DocumentDB manage them in Secrets Manager.
 * Provisioning a cluster (and its first instance) takes several minutes.
 *
 * Mutable fields are reconciled in place against the observed cloud state;
 * immutable fields (`engine`, `dbSubnetGroupName`, `storageEncrypted`,
 * `kmsKeyId`, `globalClusterIdentifier`, `availabilityZones`,
 * `masterUsername`) force a replacement.
 * ### Creating a Cluster
 * **Example:** DocumentDB cluster with a managed master secret
 * ```typescript
 * const cluster = yield* DBCluster("Docs", {
 *   dbSubnetGroupName: subnetGroup.dbSubnetGroupName,
 *   vpcSecurityGroupIds: [sg.groupId],
 *   masterUsername: "alchemy",
 *   manageMasterUserPassword: true,
 *   backupRetentionPeriod: "7 days",
 *   deletionProtection: false,
 * });
 * ```
 *
 * ### Logs & Encryption
 * **Example:** Export audit logs and encrypt storage
 * ```typescript
 * const cluster = yield* DBCluster("Docs", {
 *   dbSubnetGroupName: subnetGroup.dbSubnetGroupName,
 *   masterUsername: "alchemy",
 *   masterUserPassword: Redacted.make("supersecret"),
 *   storageEncrypted: true,
 *   enableCloudwatchLogsExports: ["audit", "profiler"],
 * });
 * ```
 *
 * @resource
 */
export const DBCluster = Resource("AWS.DocDB.DBCluster");
const toTagRecord = (tags) => Object.fromEntries((tags ?? [])
    .filter((tag) => typeof tag.Key === "string" && typeof tag.Value === "string")
    .map((tag) => [tag.Key, tag.Value]));
const toAttrs = ({ cluster, tags, }) => ({
    dbClusterIdentifier: cluster.DBClusterIdentifier ?? "",
    dbClusterArn: cluster.DBClusterArn ?? "",
    dbSubnetGroupName: cluster.DBSubnetGroup,
    endpoint: cluster.Endpoint,
    readerEndpoint: cluster.ReaderEndpoint,
    port: cluster.Port,
    engine: cluster.Engine ?? "docdb",
    engineVersion: cluster.EngineVersion,
    status: cluster.Status,
    masterUsername: cluster.MasterUsername,
    masterUserSecretArn: cluster.MasterUserSecret?.SecretArn,
    vpcSecurityGroupIds: (cluster.VpcSecurityGroups ?? []).flatMap((group) => group.VpcSecurityGroupId ? [group.VpcSecurityGroupId] : []),
    backupRetentionPeriod: cluster.BackupRetentionPeriod,
    preferredBackupWindow: cluster.PreferredBackupWindow,
    preferredMaintenanceWindow: cluster.PreferredMaintenanceWindow,
    storageEncrypted: cluster.StorageEncrypted,
    kmsKeyId: cluster.KmsKeyId,
    deletionProtection: cluster.DeletionProtection,
    dbClusterMembers: (cluster.DBClusterMembers ?? []).map((member) => ({
        dbInstanceIdentifier: member.DBInstanceIdentifier,
        isClusterWriter: member.IsClusterWriter,
        promotionTier: member.PromotionTier,
    })),
    dbClusterResourceId: cluster.DbClusterResourceId,
    hostedZoneId: cluster.HostedZoneId,
    multiAZ: cluster.MultiAZ,
    enabledCloudwatchLogsExports: cluster.EnabledCloudwatchLogsExports ?? [],
    clusterCreateTime: cluster.ClusterCreateTime?.toISOString(),
    storageType: cluster.StorageType,
    networkType: cluster.NetworkType,
    tags,
});
/**
 * Compute the CloudWatch Logs export delta. The modify API is delta-shaped
 * (`EnableLogTypes`/`DisableLogTypes`), so it must NOT carry the full set.
 * Returns `undefined` when there is no change.
 */
const logExportDelta = (observed, desired) => {
    if (desired === undefined)
        return undefined;
    const have = new Set(observed ?? []);
    const want = new Set(desired);
    const EnableLogTypes = [...want].filter((t) => !have.has(t));
    const DisableLogTypes = [...have].filter((t) => !want.has(t));
    if (EnableLogTypes.length === 0 && DisableLogTypes.length === 0) {
        return undefined;
    }
    return {
        ...(EnableLogTypes.length > 0 ? { EnableLogTypes } : {}),
        ...(DisableLogTypes.length > 0 ? { DisableLogTypes } : {}),
    };
};
export const DBClusterProvider = () => Provider.effect(DBCluster, Effect.gen(function* () {
    const toIdentifier = (id, props) => props.dbClusterIdentifier
        ? Effect.succeed(props.dbClusterIdentifier)
        : createPhysicalName({ id, maxLength: 63 });
    const readCluster = Effect.fn(function* (clusterId) {
        const response = yield* docdb
            .describeDBClusters({
            DBClusterIdentifier: clusterId,
        })
            .pipe(Effect.catchTag("DBClusterNotFoundFault", () => Effect.succeed(undefined)));
        return response?.DBClusters?.[0];
    });
    const readTags = Effect.fn(function* (arn) {
        if (!arn)
            return {};
        const response = yield* docdb
            .listTagsForResource({ ResourceName: arn })
            .pipe(Effect.catchTag("DBClusterNotFoundFault", () => Effect.succeed(undefined)));
        return toTagRecord(response?.TagList);
    });
    // Bounded readiness wait. Gate on cluster `Status === "available"` so a
    // follow-on `modifyDBCluster` doesn't hit `InvalidDBClusterStateFault`.
    // Budgets ~10 min (60 * 10s) for slow provisioning.
    const waitForCluster = Effect.fn(function* (clusterId) {
        const readinessPolicy = Schedule.max([
            Schedule.fixed("10 seconds"),
            Schedule.recurs(60),
        ]);
        return yield* readCluster(clusterId).pipe(Effect.flatMap((cluster) => {
            if (!cluster?.DBClusterArn) {
                return Effect.fail(new Error(`DB cluster '${clusterId}' not found`));
            }
            if (cluster.Status !== "available") {
                return Effect.fail(new Error(`DB cluster '${clusterId}' not available (status: ${cluster.Status})`));
            }
            return Effect.succeed(cluster);
        }), Effect.retry({ schedule: readinessPolicy }));
    });
    return {
        stables: ["dbClusterArn", "dbClusterIdentifier"],
        // AWS account/region collection: exhaustively paginate
        // `describeDBClusters` and map each cluster to the exact `read`
        // Attributes shape. DocumentDB does not surface tags inline on the
        // cluster, so — mirroring `DBSubnetGroup.list` — we emit an empty tag
        // map rather than issuing a per-item `listTagsForResource` fan-out.
        list: () => docdb.describeDBClusters.pages({}).pipe(Stream.runCollect, Effect.map((chunk) => Array.from(chunk).flatMap((page) => (page.DBClusters ?? []).map((cluster) => toAttrs({ cluster, tags: {} }))))),
        diff: Effect.fn(function* ({ id, olds, news }) {
            if (!isResolved(news))
                return;
            if ((yield* toIdentifier(id, olds ?? {})) !==
                (yield* toIdentifier(id, news))) {
                return { action: "replace" };
            }
            // Immutable props — any change forces a fresh cluster.
            if (olds !== undefined &&
                ((olds.engine ?? "docdb") !== (news.engine ?? "docdb") ||
                    olds.dbSubnetGroupName !== news.dbSubnetGroupName ||
                    olds.storageEncrypted !== news.storageEncrypted ||
                    olds.kmsKeyId !== news.kmsKeyId ||
                    olds.masterUsername !== news.masterUsername ||
                    olds.globalClusterIdentifier !== news.globalClusterIdentifier ||
                    JSON.stringify(olds.availabilityZones ?? []) !==
                        JSON.stringify(news.availabilityZones ?? []))) {
                return { action: "replace" };
            }
        }),
        read: Effect.fn(function* ({ id, olds, output }) {
            const identifier = output?.dbClusterIdentifier ??
                (yield* toIdentifier(id, olds ?? {}));
            const cluster = yield* readCluster(identifier);
            if (!cluster?.DBClusterArn) {
                return undefined;
            }
            const tags = yield* readTags(cluster.DBClusterArn);
            return toAttrs({ cluster, tags });
        }),
        reconcile: Effect.fn(function* ({ id, news, output, session }) {
            const identifier = output?.dbClusterIdentifier ?? (yield* toIdentifier(id, news));
            const internalTags = yield* createInternalTags(id);
            const desiredTags = { ...internalTags, ...news.tags };
            // Redacted end-to-end: distilled's `MasterUserPassword` is
            // SensitiveString, so the Redacted value is passed through without
            // unwrapping and never appears in traces.
            const masterUserPassword = news.masterUserPassword;
            // Observe — fetch live cluster state.
            let observed = yield* readCluster(identifier);
            // Ensure — create the cluster if it's missing. Tolerate
            // `DBClusterAlreadyExistsFault` as a race with a peer reconciler.
            if (!observed?.DBClusterArn) {
                yield* docdb
                    .createDBCluster({
                    DBClusterIdentifier: identifier,
                    Engine: news.engine ?? "docdb",
                    EngineVersion: news.engineVersion,
                    DBSubnetGroupName: news.dbSubnetGroupName,
                    DBClusterParameterGroupName: news.dbClusterParameterGroupName,
                    VpcSecurityGroupIds: news.vpcSecurityGroupIds,
                    Port: news.port,
                    AvailabilityZones: news.availabilityZones,
                    BackupRetentionPeriod: toWireDays(news.backupRetentionPeriod),
                    PreferredBackupWindow: news.preferredBackupWindow,
                    PreferredMaintenanceWindow: news.preferredMaintenanceWindow,
                    EnableCloudwatchLogsExports: news.enableCloudwatchLogsExports,
                    DeletionProtection: news.deletionProtection,
                    StorageEncrypted: news.storageEncrypted,
                    KmsKeyId: news.kmsKeyId,
                    StorageType: news.storageType,
                    NetworkType: news.networkType,
                    GlobalClusterIdentifier: news.globalClusterIdentifier,
                    MasterUsername: news.masterUsername,
                    MasterUserPassword: masterUserPassword,
                    ManageMasterUserPassword: news.manageMasterUserPassword,
                    MasterUserSecretKmsKeyId: news.masterUserSecretKmsKeyId,
                    Tags: Object.entries(desiredTags).map(([Key, Value]) => ({
                        Key,
                        Value,
                    })),
                })
                    .pipe(Effect.catchTag("DBClusterAlreadyExistsFault", () => Effect.void));
                observed = yield* waitForCluster(identifier);
            }
            else {
                // Wait for the cluster to settle before any modify so the call
                // doesn't hit `InvalidDBClusterStateFault`.
                observed = yield* waitForCluster(identifier);
                // syncCoreSettings — single `modifyDBCluster` carrying scalar
                // in-place fields, only emitting a field when the desired value
                // differs from the observed cloud state.
                const core = {
                    DBClusterIdentifier: identifier,
                    ApplyImmediately: true,
                };
                let coreDirty = false;
                const setIf = (key, desired, observedValue) => {
                    if (desired !== undefined && desired !== observedValue) {
                        core[key] = desired;
                        coreDirty = true;
                    }
                };
                setIf("EngineVersion", news.engineVersion, observed.EngineVersion);
                setIf("Port", news.port, observed.Port);
                setIf("BackupRetentionPeriod", toWireDays(news.backupRetentionPeriod), observed.BackupRetentionPeriod); // prettier-ignore
                setIf("PreferredBackupWindow", news.preferredBackupWindow, observed.PreferredBackupWindow); // prettier-ignore
                setIf("PreferredMaintenanceWindow", news.preferredMaintenanceWindow, observed.PreferredMaintenanceWindow); // prettier-ignore
                setIf("DeletionProtection", news.deletionProtection, observed.DeletionProtection); // prettier-ignore
                setIf("StorageType", news.storageType, observed.StorageType);
                setIf("NetworkType", news.networkType, observed.NetworkType);
                setIf("DBClusterParameterGroupName", news.dbClusterParameterGroupName, observed.DBClusterParameterGroup); // prettier-ignore
                setIf("MasterUserSecretKmsKeyId", news.masterUserSecretKmsKeyId, undefined); // prettier-ignore
                if (news.vpcSecurityGroupIds !== undefined) {
                    core.VpcSecurityGroupIds = news.vpcSecurityGroupIds;
                    coreDirty = true;
                }
                if (news.allowMajorVersionUpgrade) {
                    core.AllowMajorVersionUpgrade = true;
                }
                // syncMasterPassword — rotation or explicit password update.
                if (news.manageMasterUserPassword &&
                    news.rotateMasterUserPassword) {
                    core.RotateMasterUserPassword = true;
                    coreDirty = true;
                }
                else if (masterUserPassword !== undefined) {
                    core.MasterUserPassword = masterUserPassword;
                    coreDirty = true;
                }
                if (coreDirty) {
                    yield* docdb.modifyDBCluster(core);
                    observed = yield* waitForCluster(identifier);
                }
                // syncCloudwatchLogsExports — delta-shaped; separate call.
                const logDelta = logExportDelta(observed.EnabledCloudwatchLogsExports, news.enableCloudwatchLogsExports);
                if (logDelta) {
                    yield* docdb.modifyDBCluster({
                        DBClusterIdentifier: identifier,
                        CloudwatchLogsExportConfiguration: logDelta,
                        ApplyImmediately: true,
                    });
                    observed = yield* waitForCluster(identifier);
                }
            }
            const dbClusterArn = observed.DBClusterArn ?? "";
            // Sync tags — diff observed cloud tags against desired.
            const observedTags = yield* readTags(dbClusterArn);
            const { removed, upsert } = diffTags(observedTags, desiredTags);
            if (upsert.length > 0 && dbClusterArn) {
                yield* docdb.addTagsToResource({
                    ResourceName: dbClusterArn,
                    Tags: upsert,
                });
            }
            if (removed.length > 0 && dbClusterArn) {
                yield* docdb.removeTagsFromResource({
                    ResourceName: dbClusterArn,
                    TagKeys: removed,
                });
            }
            yield* session.note(dbClusterArn || identifier);
            return toAttrs({ cluster: observed, tags: desiredTags });
        }),
        delete: Effect.fn(function* ({ output }) {
            yield* docdb
                .deleteDBCluster({
                DBClusterIdentifier: output.dbClusterIdentifier,
                SkipFinalSnapshot: true,
            })
                .pipe(Effect.catchTag("DBClusterNotFoundFault", () => Effect.void));
            // Block until the cluster is fully gone. DocumentDB deletion is
            // async; if we return while it is still `deleting`, a dependent
            // (DBSubnetGroup or VPC) is torn down next and AWS rejects it.
            yield* Effect.repeat(docdb
                .describeDBClusters({
                DBClusterIdentifier: output.dbClusterIdentifier,
            })
                .pipe(Effect.as(true), Effect.catchTag("DBClusterNotFoundFault", () => Effect.succeed(false))), {
                schedule: Schedule.max([
                    Schedule.fixed("15 seconds"),
                    Schedule.recurs(40),
                ]),
                until: (exists) => exists === false,
            }).pipe(Effect.catch(() => Effect.void));
        }),
    };
}));
//# sourceMappingURL=DBCluster.js.map