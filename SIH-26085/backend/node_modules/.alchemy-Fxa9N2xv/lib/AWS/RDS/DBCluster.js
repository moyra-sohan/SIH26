import * as rds from "@distilled.cloud/aws/rds";
import * as secretsmanager from "@distilled.cloud/aws/secrets-manager";
import * as Effect from "effect/Effect";
import * as Redacted from "effect/Redacted";
import * as Schedule from "effect/Schedule";
import * as Stream from "effect/Stream";
import { isResolved } from "../../Diff.js";
import { toWireDays, toWireSeconds } from "../../Util/Duration.js";
import { createPhysicalName } from "../../PhysicalName.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
import { createInternalTags, diffTags } from "../../Tags.js";
/**
 * An Aurora DB cluster.
 *
 * `DBCluster` owns the writer and reader endpoints, cluster-wide networking,
 * and Data API enablement. It can bootstrap master credentials directly or by
 * reading a Secrets Manager secret that contains `username` and `password`.
 *
 * It exposes the full backup, maintenance, monitoring, performance-insights,
 * encryption, scaling, and log-export surface of `createDBCluster` /
 * `modifyDBCluster`. Mutable fields are reconciled in place against the
 * observed cloud state; immutable fields (`engine`, `databaseName`,
 * `dbSubnetGroupName`, `storageEncrypted`, `kmsKeyId`, `engineMode`,
 * `globalClusterIdentifier`, `availabilityZones`, `engineLifecycleSupport`)
 * force a replacement.
 * ### Serverless v2 Cluster
 * **Example:** Aurora Postgres serverless-v2
 * ```typescript
 * const cluster = yield* DBCluster("Cluster", {
 *   engine: "aurora-postgresql",
 *   engineMode: "provisioned",
 *   serverlessV2ScalingConfiguration: { MinCapacity: 0.5, MaxCapacity: 4 },
 *   manageMasterUserPassword: true,
 *   masterUsername: "alchemy",
 *   backupRetentionPeriod: "7 days",
 *   deletionProtection: false,
 * });
 * ```
 *
 * ### Logs & Monitoring
 * **Example:** Export logs and enable Performance Insights
 * ```typescript
 * const cluster = yield* DBCluster("Cluster", {
 *   engine: "aurora-postgresql",
 *   enableCloudwatchLogsExports: ["postgresql"],
 *   enablePerformanceInsights: true,
 *   monitoringInterval: "60 seconds",
 *   monitoringRoleArn: monitoringRole.roleArn,
 * });
 * ```
 *
 * @resource
 */
export const DBCluster = Resource("AWS.RDS.DBCluster");
const toTagRecord = (tags) => Object.fromEntries((tags ?? [])
    .filter((tag) => typeof tag.Key === "string" && typeof tag.Value === "string")
    .map((tag) => [tag.Key, tag.Value]));
const resolveMasterCredentials = (props) => Effect.gen(function* () {
    if (props.masterUserSecretArn) {
        const value = yield* secretsmanager.getSecretValue({
            SecretId: props.masterUserSecretArn,
        });
        const secretString = value.SecretString
            ? typeof value.SecretString === "string"
                ? value.SecretString
                : Redacted.value(value.SecretString)
            : undefined;
        const secret = secretString
            ? JSON.parse(secretString)
            : {};
        return {
            MasterUsername: props.masterUsername ?? secret.username,
            MasterUserPassword: props.masterUserPassword ?? secret.password,
        };
    }
    return {
        MasterUsername: props.masterUsername,
        MasterUserPassword: props.masterUserPassword,
    };
});
const toAttrs = ({ cluster, tags, }) => ({
    dbClusterIdentifier: cluster.DBClusterIdentifier ?? "",
    dbClusterArn: cluster.DBClusterArn ?? "",
    dbSubnetGroupName: cluster.DBSubnetGroup,
    endpoint: cluster.Endpoint,
    readerEndpoint: cluster.ReaderEndpoint,
    port: cluster.Port,
    engine: cluster.Engine ?? "",
    engineVersion: cluster.EngineVersion,
    status: cluster.Status,
    databaseName: cluster.DatabaseName,
    masterUsername: cluster.MasterUsername,
    masterUserSecretArn: cluster.MasterUserSecret?.SecretArn,
    vpcSecurityGroupIds: (cluster.VpcSecurityGroups ?? []).flatMap((group) => group.VpcSecurityGroupId ? [group.VpcSecurityGroupId] : []),
    httpEndpointEnabled: cluster.HttpEndpointEnabled,
    allocatedStorage: cluster.AllocatedStorage,
    backupRetentionPeriod: cluster.BackupRetentionPeriod,
    preferredBackupWindow: cluster.PreferredBackupWindow,
    preferredMaintenanceWindow: cluster.PreferredMaintenanceWindow,
    storageEncrypted: cluster.StorageEncrypted,
    kmsKeyId: cluster.KmsKeyId,
    deletionProtection: cluster.DeletionProtection,
    iamDatabaseAuthenticationEnabled: cluster.IAMDatabaseAuthenticationEnabled,
    engineMode: cluster.EngineMode,
    dbClusterMembers: (cluster.DBClusterMembers ?? []).map((member) => ({
        dbInstanceIdentifier: member.DBInstanceIdentifier,
        isClusterWriter: member.IsClusterWriter,
        promotionTier: member.PromotionTier,
    })),
    dbClusterResourceId: cluster.DbClusterResourceId,
    hostedZoneId: cluster.HostedZoneId,
    multiAZ: cluster.MultiAZ,
    enabledCloudwatchLogsExports: cluster.EnabledCloudwatchLogsExports ?? [],
    copyTagsToSnapshot: cluster.CopyTagsToSnapshot,
    clusterCreateTime: cluster.ClusterCreateTime?.toISOString(),
    serverlessV2PlatformVersion: cluster.ServerlessV2PlatformVersion,
    monitoringInterval: cluster.MonitoringInterval,
    performanceInsightsEnabled: cluster.PerformanceInsightsEnabled,
    dbClusterInstanceClass: cluster.DBClusterInstanceClass,
    storageType: cluster.StorageType,
    iops: cluster.Iops,
    networkType: cluster.NetworkType,
    customEndpoints: cluster.CustomEndpoints ?? [],
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
        const response = yield* rds
            .describeDBClusters({
            DBClusterIdentifier: clusterId,
        })
            .pipe(Effect.catchTag("DBClusterNotFoundFault", () => Effect.succeed(undefined)));
        return response?.DBClusters?.[0];
    });
    // Bounded readiness wait. Gate on cluster `Status === "available"` so a
    // follow-on `modifyDBCluster` doesn't hit `InvalidDBClusterStateFault`.
    // Budgets ~10 min (60 * 10s) for slow provisioning. `requireAvailable:
    // false` only waits for the ARN to appear.
    const waitForCluster = Effect.fn(function* (clusterId, { requireAvailable = true } = {}) {
        const readinessPolicy = Schedule.max([
            Schedule.fixed("10 seconds"),
            Schedule.recurs(60),
        ]);
        return yield* readCluster(clusterId).pipe(Effect.flatMap((cluster) => {
            if (!cluster?.DBClusterArn) {
                return Effect.fail(new Error(`DB cluster '${clusterId}' not found`));
            }
            if (requireAvailable && cluster.Status !== "available") {
                return Effect.fail(new Error(`DB cluster '${clusterId}' not available (status: ${cluster.Status})`));
            }
            return Effect.succeed(cluster);
        }), Effect.retry({ schedule: readinessPolicy }));
    });
    return {
        stables: ["dbClusterArn", "dbClusterIdentifier"],
        // AWS account/region collection (pattern a): exhaustively paginate
        // `describeDBClusters` and map each cluster to the exact `read`
        // Attributes shape. Tags come inline on `DBCluster.TagList`, so no
        // per-item `listTagsForResource` hydration is needed (matching `read`).
        list: () => Effect.gen(function* () {
            return yield* rds.describeDBClusters.pages({}).pipe(Stream.runCollect, Effect.map((chunk) => Array.from(chunk).flatMap((page) => (page.DBClusters ?? []).map((cluster) => toAttrs({
                cluster,
                tags: toTagRecord(cluster.TagList),
            })))));
        }),
        diff: Effect.fn(function* ({ id, olds, news }) {
            if (!isResolved(news))
                return;
            if ((yield* toIdentifier(id, olds ?? {})) !==
                (yield* toIdentifier(id, news))) {
                return { action: "replace" };
            }
            // Immutable props — any change forces a fresh cluster.
            if (olds !== undefined &&
                (olds.engine !== news.engine ||
                    olds.databaseName !== news.databaseName ||
                    olds.dbSubnetGroupName !== news.dbSubnetGroupName ||
                    olds.storageEncrypted !== news.storageEncrypted ||
                    olds.kmsKeyId !== news.kmsKeyId ||
                    olds.engineMode !== news.engineMode ||
                    olds.globalClusterIdentifier !== news.globalClusterIdentifier ||
                    olds.engineLifecycleSupport !== news.engineLifecycleSupport ||
                    JSON.stringify(olds.availabilityZones ?? []) !==
                        JSON.stringify(news.availabilityZones ?? []))) {
                return { action: "replace" };
            }
        }),
        read: Effect.fn(function* ({ id, olds, output }) {
            const identifier = output?.dbClusterIdentifier ??
                (yield* toIdentifier(id, olds ?? { engine: "" }));
            const cluster = yield* readCluster(identifier);
            if (!cluster?.DBClusterArn) {
                return undefined;
            }
            return toAttrs({
                cluster,
                tags: toTagRecord(cluster.TagList),
            });
        }),
        reconcile: Effect.fn(function* ({ id, news, output, session }) {
            const identifier = output?.dbClusterIdentifier ?? (yield* toIdentifier(id, news));
            const internalTags = yield* createInternalTags(id);
            const desiredTags = { ...internalTags, ...news.tags };
            const credentials = yield* resolveMasterCredentials(news);
            // Duration props → the exact wire units the RDS API expects.
            const backupRetentionDays = toWireDays(news.backupRetentionPeriod);
            const backtrackWindowSeconds = toWireSeconds(news.backtrackWindow);
            const monitoringIntervalSeconds = toWireSeconds(news.monitoringInterval);
            const performanceInsightsRetentionDays = toWireDays(news.performanceInsightsRetentionPeriod);
            // Observe — fetch live cluster state. We never trust `output`
            // blindly: the cluster may have been deleted out-of-band, or this
            // may be a first-time reconcile after adoption.
            let observed = yield* readCluster(identifier);
            // Ensure — create the cluster if it's missing. Tolerate
            // `DBClusterAlreadyExistsFault` as a race with a peer reconciler
            // (e.g. retry after state-persistence failure).
            if (!observed?.DBClusterArn) {
                yield* rds
                    .createDBCluster({
                    DBClusterIdentifier: identifier,
                    Engine: news.engine,
                    EngineVersion: news.engineVersion,
                    DatabaseName: news.databaseName,
                    DBSubnetGroupName: news.dbSubnetGroupName,
                    DBClusterParameterGroupName: news.dbClusterParameterGroupName,
                    VpcSecurityGroupIds: news.vpcSecurityGroupIds,
                    Port: news.port,
                    AvailabilityZones: news.availabilityZones,
                    BackupRetentionPeriod: backupRetentionDays,
                    PreferredBackupWindow: news.preferredBackupWindow,
                    PreferredMaintenanceWindow: news.preferredMaintenanceWindow,
                    BacktrackWindow: backtrackWindowSeconds,
                    OptionGroupName: news.optionGroupName,
                    EnableCloudwatchLogsExports: news.enableCloudwatchLogsExports,
                    EnableIAMDatabaseAuthentication: news.enableIAMDatabaseAuthentication,
                    EnableHttpEndpoint: news.enableHttpEndpoint,
                    EngineMode: news.engineMode,
                    ScalingConfiguration: news.scalingConfiguration,
                    ServerlessV2ScalingConfiguration: news.serverlessV2ScalingConfiguration,
                    AutoMinorVersionUpgrade: news.autoMinorVersionUpgrade,
                    MonitoringInterval: monitoringIntervalSeconds,
                    MonitoringRoleArn: news.monitoringRoleArn,
                    EnablePerformanceInsights: news.enablePerformanceInsights,
                    PerformanceInsightsKMSKeyId: news.performanceInsightsKMSKeyId,
                    PerformanceInsightsRetentionPeriod: performanceInsightsRetentionDays,
                    NetworkType: news.networkType,
                    CACertificateIdentifier: news.caCertificateIdentifier,
                    MasterUserSecretKmsKeyId: news.masterUserSecretKmsKeyId,
                    EnableGlobalWriteForwarding: news.enableGlobalWriteForwarding,
                    EnableLocalWriteForwarding: news.enableLocalWriteForwarding,
                    GlobalClusterIdentifier: news.globalClusterIdentifier,
                    DBClusterInstanceClass: news.dbClusterInstanceClass,
                    AllocatedStorage: news.allocatedStorage,
                    StorageType: news.storageType,
                    Iops: news.iops,
                    PubliclyAccessible: news.publiclyAccessible,
                    EngineLifecycleSupport: news.engineLifecycleSupport,
                    CopyTagsToSnapshot: news.copyTagsToSnapshot,
                    DeletionProtection: news.deletionProtection,
                    StorageEncrypted: news.storageEncrypted,
                    KmsKeyId: news.kmsKeyId,
                    ManageMasterUserPassword: news.manageMasterUserPassword,
                    Tags: Object.entries(desiredTags).map(([Key, Value]) => ({
                        Key,
                        Value,
                    })),
                    ...credentials,
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
                setIf("BacktrackWindow", backtrackWindowSeconds, observed.BacktrackWindow); // prettier-ignore
                setIf("DeletionProtection", news.deletionProtection, observed.DeletionProtection); // prettier-ignore
                setIf("CopyTagsToSnapshot", news.copyTagsToSnapshot, observed.CopyTagsToSnapshot); // prettier-ignore
                setIf("EnableIAMDatabaseAuthentication", news.enableIAMDatabaseAuthentication, observed.IAMDatabaseAuthenticationEnabled); // prettier-ignore
                setIf("EnableHttpEndpoint", news.enableHttpEndpoint, observed.HttpEndpointEnabled); // prettier-ignore
                setIf("AutoMinorVersionUpgrade", news.autoMinorVersionUpgrade, observed.AutoMinorVersionUpgrade); // prettier-ignore
                setIf("MonitoringInterval", monitoringIntervalSeconds, observed.MonitoringInterval); // prettier-ignore
                setIf("MonitoringRoleArn", news.monitoringRoleArn, observed.MonitoringRoleArn); // prettier-ignore
                setIf("EnablePerformanceInsights", news.enablePerformanceInsights, observed.PerformanceInsightsEnabled); // prettier-ignore
                setIf("PerformanceInsightsKMSKeyId", news.performanceInsightsKMSKeyId, observed.PerformanceInsightsKMSKeyId); // prettier-ignore
                setIf("PerformanceInsightsRetentionPeriod", performanceInsightsRetentionDays, observed.PerformanceInsightsRetentionPeriod); // prettier-ignore
                setIf("NetworkType", news.networkType, observed.NetworkType);
                setIf("DBClusterInstanceClass", news.dbClusterInstanceClass, observed.DBClusterInstanceClass); // prettier-ignore
                setIf("AllocatedStorage", news.allocatedStorage, observed.AllocatedStorage); // prettier-ignore
                setIf("StorageType", news.storageType, observed.StorageType);
                setIf("Iops", news.iops, observed.Iops);
                setIf("OptionGroupName", news.optionGroupName, undefined);
                setIf("DBClusterParameterGroupName", news.dbClusterParameterGroupName, observed.DBClusterParameterGroup); // prettier-ignore
                setIf("EnableGlobalWriteForwarding", news.enableGlobalWriteForwarding, undefined); // prettier-ignore
                setIf("EnableLocalWriteForwarding", news.enableLocalWriteForwarding, undefined); // prettier-ignore
                setIf("CACertificateIdentifier", news.caCertificateIdentifier, undefined); // prettier-ignore
                if (news.scalingConfiguration !== undefined) {
                    core.ScalingConfiguration = news.scalingConfiguration;
                    coreDirty = true;
                }
                if (news.serverlessV2ScalingConfiguration !== undefined) {
                    core.ServerlessV2ScalingConfiguration =
                        news.serverlessV2ScalingConfiguration;
                    coreDirty = true;
                }
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
                else if (credentials.MasterUserPassword !== undefined) {
                    core.MasterUserPassword = credentials.MasterUserPassword;
                    coreDirty = true;
                }
                if (coreDirty) {
                    yield* rds.modifyDBCluster(core);
                    observed = yield* waitForCluster(identifier);
                }
                // syncCloudwatchLogsExports — delta-shaped; separate call.
                const logDelta = logExportDelta(observed.EnabledCloudwatchLogsExports, news.enableCloudwatchLogsExports);
                if (logDelta) {
                    yield* rds.modifyDBCluster({
                        DBClusterIdentifier: identifier,
                        CloudwatchLogsExportConfiguration: logDelta,
                        ApplyImmediately: true,
                    });
                    observed = yield* waitForCluster(identifier);
                }
            }
            const dbClusterArn = observed.DBClusterArn ?? "";
            // Sync tags — diff observed cloud tags against desired so the
            // reconciler converges regardless of what was on the resource
            // before (initial create, adoption, or drift).
            const observedTags = toTagRecord(observed.TagList);
            const { removed, upsert } = diffTags(observedTags, desiredTags);
            if (upsert.length > 0 && dbClusterArn) {
                yield* rds.addTagsToResource({
                    ResourceName: dbClusterArn,
                    Tags: upsert,
                });
            }
            if (removed.length > 0 && dbClusterArn) {
                yield* rds.removeTagsFromResource({
                    ResourceName: dbClusterArn,
                    TagKeys: removed,
                });
            }
            yield* session.note(dbClusterArn || identifier);
            return toAttrs({ cluster: observed, tags: desiredTags });
        }),
        delete: Effect.fn(function* ({ output }) {
            yield* rds
                .deleteDBCluster({
                DBClusterIdentifier: output.dbClusterIdentifier,
                SkipFinalSnapshot: true,
            })
                .pipe(Effect.catchTag("DBClusterNotFoundFault", () => Effect.void));
            // Block until the cluster is fully gone. RDS deletion is async; if we
            // return while it is still `deleting`, a dependent (e.g. a
            // DBSubnetGroup or VPC) is torn down next and AWS rejects it with
            // `InvalidDBSubnetGroupStateFault: ... still using it`.
            yield* Effect.repeat(rds
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