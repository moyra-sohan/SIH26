import * as neptune from "@distilled.cloud/aws/neptune";
import * as Effect from "effect/Effect";
import * as Schedule from "effect/Schedule";
import * as Stream from "effect/Stream";
import { isResolved } from "../../Diff.js";
import { createPhysicalName } from "../../PhysicalName.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
import { createInternalTags, diffTags } from "../../Tags.js";
import { toWireDays } from "../../Util/Duration.js";
/**
 * An Amazon Neptune graph database cluster.
 *
 * `DBCluster` owns the writer and reader endpoints and cluster-wide
 * networking; compute is added via {@link DBInstance}. Neptune serves
 * Gremlin, openCypher, and SPARQL over the cluster endpoint (default port
 * 8182) and is reachable only from inside the VPC. Provisioning a cluster
 * plus its first instance takes ~10 minutes.
 *
 * Mutable fields are reconciled in place against the observed cloud state;
 * immutable fields (`engine`, `dbSubnetGroupName`, `storageEncrypted`,
 * `kmsKeyId`, `globalClusterIdentifier`, `availabilityZones`) force a
 * replacement.
 * ### Creating a Cluster
 * **Example:** Neptune cluster with IAM auth
 * ```typescript
 * const cluster = yield* DBCluster("Graph", {
 *   dbSubnetGroupName: subnetGroup.dbSubnetGroupName,
 *   vpcSecurityGroupIds: [sg.groupId],
 *   enableIAMDatabaseAuthentication: true,
 *   backupRetentionPeriod: "1 day",
 *   deletionProtection: false,
 * });
 * ```
 *
 * ### Serverless
 * **Example:** Serverless v2 cluster (pair with a `db.serverless` instance)
 * ```typescript
 * const cluster = yield* DBCluster("Graph", {
 *   dbSubnetGroupName: subnetGroup.dbSubnetGroupName,
 *   serverlessV2ScalingConfiguration: {
 *     minCapacity: 1,
 *     maxCapacity: 2.5,
 *   },
 * });
 * ```
 *
 * @resource
 */
export const DBCluster = Resource("AWS.Neptune.DBCluster");
const toTagRecord = (tags) => Object.fromEntries((tags ?? [])
    .filter((tag) => typeof tag.Key === "string" && typeof tag.Value === "string")
    .map((tag) => [tag.Key, tag.Value]));
const toAttrs = ({ cluster, tags, }) => ({
    dbClusterIdentifier: cluster.DBClusterIdentifier ?? "",
    dbClusterArn: cluster.DBClusterArn ?? "",
    dbSubnetGroupName: cluster.DBSubnetGroup,
    dbClusterParameterGroupName: cluster.DBClusterParameterGroup,
    endpoint: cluster.Endpoint,
    readerEndpoint: cluster.ReaderEndpoint,
    port: cluster.Port,
    engine: cluster.Engine ?? "neptune",
    engineVersion: cluster.EngineVersion,
    status: cluster.Status,
    vpcSecurityGroupIds: (cluster.VpcSecurityGroups ?? []).flatMap((group) => group.VpcSecurityGroupId ? [group.VpcSecurityGroupId] : []),
    backupRetentionPeriod: cluster.BackupRetentionPeriod,
    preferredBackupWindow: cluster.PreferredBackupWindow,
    preferredMaintenanceWindow: cluster.PreferredMaintenanceWindow,
    storageEncrypted: cluster.StorageEncrypted,
    kmsKeyId: cluster.KmsKeyId,
    deletionProtection: cluster.DeletionProtection,
    iamDatabaseAuthenticationEnabled: cluster.IAMDatabaseAuthenticationEnabled,
    associatedRoles: (cluster.AssociatedRoles ?? []).map((role) => ({
        roleArn: role.RoleArn,
        featureName: role.FeatureName,
        status: role.Status,
    })),
    serverlessV2ScalingConfiguration: cluster.ServerlessV2ScalingConfiguration
        ? {
            minCapacity: cluster.ServerlessV2ScalingConfiguration.MinCapacity,
            maxCapacity: cluster.ServerlessV2ScalingConfiguration.MaxCapacity,
        }
        : undefined,
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
    copyTagsToSnapshot: cluster.CopyTagsToSnapshot,
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
        const response = yield* neptune
            .describeDBClusters({
            DBClusterIdentifier: clusterId,
        })
            .pipe(Effect.catchTag("DBClusterNotFoundFault", () => Effect.succeed(undefined)));
        return response?.DBClusters?.[0];
    });
    const readTags = Effect.fn(function* (arn) {
        if (!arn)
            return {};
        const response = yield* neptune
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
        // AWS account/region collection: the RDS-family control plane serves
        // clusters for every engine (RDS, DocumentDB, Neptune), so filter to
        // `engine = neptune`. Tags are not surfaced inline — mirror
        // `DBSubnetGroup.list` and emit an empty tag map rather than a
        // per-item `listTagsForResource` fan-out.
        list: () => neptune.describeDBClusters
            .pages({ Filters: [{ Name: "engine", Values: ["neptune"] }] })
            .pipe(Stream.runCollect, Effect.map((chunk) => Array.from(chunk).flatMap((page) => (page.DBClusters ?? []).map((cluster) => toAttrs({ cluster, tags: {} }))))),
        diff: Effect.fn(function* ({ id, olds, news }) {
            if (!isResolved(news))
                return;
            if ((yield* toIdentifier(id, olds ?? {})) !==
                (yield* toIdentifier(id, news))) {
                return { action: "replace" };
            }
            // Immutable props — any change forces a fresh cluster.
            if (olds !== undefined &&
                ((olds.engine ?? "neptune") !== (news.engine ?? "neptune") ||
                    olds.dbSubnetGroupName !== news.dbSubnetGroupName ||
                    olds.storageEncrypted !== news.storageEncrypted ||
                    olds.kmsKeyId !== news.kmsKeyId ||
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
            // The wire field is whole days.
            const backupRetentionDays = toWireDays(news.backupRetentionPeriod);
            // Observe — fetch live cluster state.
            let observed = yield* readCluster(identifier);
            // Ensure — create the cluster if it's missing. Tolerate
            // `DBClusterAlreadyExistsFault` as a race with a peer reconciler.
            if (!observed?.DBClusterArn) {
                yield* neptune
                    .createDBCluster({
                    DBClusterIdentifier: identifier,
                    Engine: news.engine ?? "neptune",
                    EngineVersion: news.engineVersion,
                    DBSubnetGroupName: news.dbSubnetGroupName,
                    DBClusterParameterGroupName: news.dbClusterParameterGroupName,
                    VpcSecurityGroupIds: news.vpcSecurityGroupIds,
                    Port: news.port,
                    AvailabilityZones: news.availabilityZones,
                    BackupRetentionPeriod: backupRetentionDays,
                    PreferredBackupWindow: news.preferredBackupWindow,
                    PreferredMaintenanceWindow: news.preferredMaintenanceWindow,
                    EnableCloudwatchLogsExports: news.enableCloudwatchLogsExports,
                    EnableIAMDatabaseAuthentication: news.enableIAMDatabaseAuthentication,
                    ServerlessV2ScalingConfiguration: news.serverlessV2ScalingConfiguration
                        ? {
                            MinCapacity: news.serverlessV2ScalingConfiguration.minCapacity,
                            MaxCapacity: news.serverlessV2ScalingConfiguration.maxCapacity,
                        }
                        : undefined,
                    DeletionProtection: news.deletionProtection,
                    StorageEncrypted: news.storageEncrypted,
                    KmsKeyId: news.kmsKeyId,
                    StorageType: news.storageType,
                    CopyTagsToSnapshot: news.copyTagsToSnapshot,
                    GlobalClusterIdentifier: news.globalClusterIdentifier,
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
                setIf("BackupRetentionPeriod", backupRetentionDays, observed.BackupRetentionPeriod); // prettier-ignore
                setIf("PreferredBackupWindow", news.preferredBackupWindow, observed.PreferredBackupWindow); // prettier-ignore
                setIf("PreferredMaintenanceWindow", news.preferredMaintenanceWindow, observed.PreferredMaintenanceWindow); // prettier-ignore
                setIf("DeletionProtection", news.deletionProtection, observed.DeletionProtection); // prettier-ignore
                setIf("StorageType", news.storageType, observed.StorageType);
                setIf("CopyTagsToSnapshot", news.copyTagsToSnapshot, observed.CopyTagsToSnapshot); // prettier-ignore
                setIf("EnableIAMDatabaseAuthentication", news.enableIAMDatabaseAuthentication, observed.IAMDatabaseAuthenticationEnabled); // prettier-ignore
                setIf("DBClusterParameterGroupName", news.dbClusterParameterGroupName, observed.DBClusterParameterGroup); // prettier-ignore
                if (news.vpcSecurityGroupIds !== undefined) {
                    const observedGroups = (observed.VpcSecurityGroups ?? [])
                        .flatMap((g) => g.VpcSecurityGroupId ? [g.VpcSecurityGroupId] : [])
                        .sort();
                    if (JSON.stringify(observedGroups) !==
                        JSON.stringify([...news.vpcSecurityGroupIds].sort())) {
                        core.VpcSecurityGroupIds = news.vpcSecurityGroupIds;
                        coreDirty = true;
                    }
                }
                if (news.serverlessV2ScalingConfiguration !== undefined) {
                    const observedScaling = observed.ServerlessV2ScalingConfiguration;
                    if (observedScaling?.MinCapacity !==
                        news.serverlessV2ScalingConfiguration.minCapacity ||
                        observedScaling?.MaxCapacity !==
                            news.serverlessV2ScalingConfiguration.maxCapacity) {
                        core.ServerlessV2ScalingConfiguration = {
                            MinCapacity: news.serverlessV2ScalingConfiguration.minCapacity,
                            MaxCapacity: news.serverlessV2ScalingConfiguration.maxCapacity,
                        };
                        coreDirty = true;
                    }
                }
                if (news.allowMajorVersionUpgrade) {
                    core.AllowMajorVersionUpgrade = true;
                }
                if (coreDirty) {
                    yield* neptune.modifyDBCluster(core);
                    observed = yield* waitForCluster(identifier);
                }
                // syncCloudwatchLogsExports — delta-shaped; separate call.
                const logDelta = logExportDelta(observed.EnabledCloudwatchLogsExports, news.enableCloudwatchLogsExports);
                if (logDelta) {
                    yield* neptune.modifyDBCluster({
                        DBClusterIdentifier: identifier,
                        CloudwatchLogsExportConfiguration: logDelta,
                        ApplyImmediately: true,
                    });
                    observed = yield* waitForCluster(identifier);
                }
            }
            // Sync associated IAM roles — diff observed cloud associations
            // against desired. Only runs when the prop is set, so clusters
            // that don't manage roles through Alchemy are left untouched.
            if (news.associatedRoles !== undefined) {
                const roleKey = (roleArn, featureName) => `${roleArn ?? ""}|${featureName ?? ""}`;
                const observedRoles = observed.AssociatedRoles ?? [];
                const observedKeys = new Set(observedRoles.map((role) => roleKey(role.RoleArn, role.FeatureName)));
                const desiredKeys = new Set(news.associatedRoles.map((role) => roleKey(role.roleArn, role.featureName)));
                for (const role of news.associatedRoles) {
                    if (!observedKeys.has(roleKey(role.roleArn, role.featureName))) {
                        yield* neptune
                            .addRoleToDBCluster({
                            DBClusterIdentifier: identifier,
                            RoleArn: role.roleArn,
                            FeatureName: role.featureName,
                        })
                            .pipe(Effect.catchTag("DBClusterRoleAlreadyExistsFault", () => Effect.void));
                    }
                }
                for (const role of observedRoles) {
                    if (role.RoleArn !== undefined &&
                        !desiredKeys.has(roleKey(role.RoleArn, role.FeatureName))) {
                        yield* neptune
                            .removeRoleFromDBCluster({
                            DBClusterIdentifier: identifier,
                            RoleArn: role.RoleArn,
                            FeatureName: role.FeatureName,
                        })
                            .pipe(Effect.catchTag("DBClusterRoleNotFoundFault", () => Effect.void));
                    }
                }
                // Re-observe so the returned attributes carry the fresh
                // associations.
                observed = (yield* readCluster(identifier)) ?? observed;
            }
            const dbClusterArn = observed.DBClusterArn ?? "";
            // Sync tags — diff observed cloud tags against desired.
            const observedTags = yield* readTags(dbClusterArn);
            const { removed, upsert } = diffTags(observedTags, desiredTags);
            if (upsert.length > 0 && dbClusterArn) {
                yield* neptune.addTagsToResource({
                    ResourceName: dbClusterArn,
                    Tags: upsert,
                });
            }
            if (removed.length > 0 && dbClusterArn) {
                yield* neptune.removeTagsFromResource({
                    ResourceName: dbClusterArn,
                    TagKeys: removed,
                });
            }
            yield* session.note(dbClusterArn || identifier);
            return toAttrs({ cluster: observed, tags: desiredTags });
        }),
        delete: Effect.fn(function* ({ output }) {
            yield* neptune
                .deleteDBCluster({
                DBClusterIdentifier: output.dbClusterIdentifier,
                SkipFinalSnapshot: true,
            })
                .pipe(Effect.catchTag("DBClusterNotFoundFault", () => Effect.void));
            // Block until the cluster is fully gone. Neptune deletion is async;
            // if we return while it is still `deleting`, a dependent
            // (DBSubnetGroup or VPC) is torn down next and AWS rejects it.
            yield* Effect.repeat(neptune
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