import * as rds from "@distilled.cloud/aws/rds";
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
import { sha256 } from "../../Util/sha256.js";
/**
 * An RDS database instance — either a standalone (non-Aurora) database or a
 * member of an Aurora `DBCluster`.
 *
 * Exposes the full storage, backup, monitoring, performance-insights,
 * encryption, networking, and log-export surface of `createDBInstance` /
 * `modifyDBInstance`. Mutable fields are reconciled in place against the
 * observed cloud state; immutable fields (`engine`, `dbName`,
 * `masterUsername`, `availabilityZone`, `storageEncrypted`, `kmsKeyId`,
 * `dbSubnetGroupName`) force a replacement.
 * ### Standalone Instance
 * **Example:** A gp3 MySQL instance
 * ```typescript
 * const db = yield* DBInstance("Db", {
 *   engine: "mysql",
 *   dbInstanceClass: "db.t3.micro",
 *   allocatedStorage: 20,
 *   storageType: "gp3",
 *   masterUsername: "admin",
 *   masterUserPassword: Redacted.make("supersecret"),
 *   backupRetentionPeriod: "7 days",
 *   deletionProtection: false,
 * });
 * ```
 *
 * ### Cluster Member
 * **Example:** An Aurora writer instance
 * ```typescript
 * const writer = yield* DBInstance("Writer", {
 *   dbClusterIdentifier: cluster.dbClusterIdentifier,
 *   dbInstanceClass: "db.serverless",
 *   engine: "aurora-postgresql",
 * });
 * ```
 *
 * ### Monitoring & Logs
 * **Example:** Enhanced monitoring + log export
 * ```typescript
 * const db = yield* DBInstance("Db", {
 *   engine: "postgres",
 *   dbInstanceClass: "db.t3.micro",
 *   allocatedStorage: 20,
 *   monitoringInterval: "60 seconds",
 *   monitoringRoleArn: monitoringRole.roleArn,
 *   enablePerformanceInsights: true,
 *   enableCloudwatchLogsExports: ["postgresql", "upgrade"],
 * });
 * ```
 *
 * @resource
 */
export const DBInstance = Resource("AWS.RDS.DBInstance");
const toTagRecord = (tags) => Object.fromEntries((tags ?? [])
    .filter((tag) => typeof tag.Key === "string" && typeof tag.Value === "string")
    .map((tag) => [tag.Key, tag.Value]));
/**
 * Whether two optional master-password fingerprints match, compared by their
 * underlying (`Redacted`-unwrapped) digest. A missing stored fingerprint
 * counts as "does not match" so a pre-existing instance sends its password
 * once, then records the fingerprint for subsequent reconciles.
 */
const sameFingerprint = (a, b) => a !== undefined && b !== undefined && Redacted.value(a) === Redacted.value(b);
const toAttrs = ({ instance, tags, skipFinalSnapshot, finalDBSnapshotIdentifier, masterUserPasswordFingerprint, }) => ({
    skipFinalSnapshot,
    finalDBSnapshotIdentifier,
    masterUserPasswordFingerprint,
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
    dbParameterGroupNames: (instance.DBParameterGroups ?? []).flatMap((group) => group.DBParameterGroupName ? [group.DBParameterGroupName] : []),
    allocatedStorage: instance.AllocatedStorage,
    maxAllocatedStorage: instance.MaxAllocatedStorage,
    storageType: instance.StorageType,
    iops: instance.Iops,
    storageThroughput: instance.StorageThroughput,
    multiAZ: instance.MultiAZ,
    availabilityZone: instance.AvailabilityZone,
    secondaryAvailabilityZone: instance.SecondaryAvailabilityZone,
    backupRetentionPeriod: instance.BackupRetentionPeriod,
    preferredBackupWindow: instance.PreferredBackupWindow,
    preferredMaintenanceWindow: instance.PreferredMaintenanceWindow,
    kmsKeyId: instance.KmsKeyId,
    storageEncrypted: instance.StorageEncrypted,
    caCertificateIdentifier: instance.CACertificateIdentifier,
    iamDatabaseAuthenticationEnabled: instance.IAMDatabaseAuthenticationEnabled,
    performanceInsightsEnabled: instance.PerformanceInsightsEnabled,
    monitoringInterval: instance.MonitoringInterval,
    enhancedMonitoringResourceArn: instance.EnhancedMonitoringResourceArn,
    enabledCloudwatchLogsExports: instance.EnabledCloudwatchLogsExports ?? [],
    deletionProtection: instance.DeletionProtection,
    dbiResourceId: instance.DbiResourceId,
    masterUsername: instance.MasterUsername,
    masterUserSecretArn: instance.MasterUserSecret?.SecretArn,
    optionGroupMemberships: (instance.OptionGroupMemberships ?? []).flatMap((membership) => membership.OptionGroupName ? [membership.OptionGroupName] : []),
    licenseModel: instance.LicenseModel,
    dbInstancePort: instance.DbInstancePort,
    networkType: instance.NetworkType,
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
export const DBInstanceProvider = () => Provider.effect(DBInstance, Effect.gen(function* () {
    const toIdentifier = (id, props) => props.dbInstanceIdentifier
        ? Effect.succeed(props.dbInstanceIdentifier)
        : createPhysicalName({ id, maxLength: 63 });
    const readInstance = Effect.fn(function* (instanceId) {
        const response = yield* rds
            .describeDBInstances({
            DBInstanceIdentifier: instanceId,
        })
            .pipe(Effect.catchTag("DBInstanceNotFoundFault", () => Effect.succeed(undefined)));
        return response?.DBInstances?.[0];
    });
    // Bounded readiness wait. Gate on `DBInstanceStatus === "available"` so a
    // follow-on `modifyDBInstance` doesn't hit `InvalidDBInstanceStateFault`.
    // `waitForAvailable` budgets ~10 min (60 * 10s) for slow provisioning;
    // `requireAvailable: false` only waits for the ARN to appear.
    const waitForInstance = Effect.fn(function* (instanceId, { requireAvailable = true } = {}) {
        const readinessPolicy = Schedule.max([
            Schedule.fixed("10 seconds"),
            Schedule.recurs(60),
        ]);
        return yield* readInstance(instanceId).pipe(Effect.flatMap((instance) => {
            if (!instance?.DBInstanceArn) {
                return Effect.fail(new Error(`DB instance '${instanceId}' not found`));
            }
            // Statuses that will never settle on their own — surface instead of
            // spinning until the bound is hit.
            const status = instance.DBInstanceStatus;
            if (requireAvailable &&
                status !== "available" &&
                status !== "incompatible-parameters" &&
                status !== "incompatible-restore") {
                return Effect.fail(new Error(`DB instance '${instanceId}' not available (status: ${status})`));
            }
            return Effect.succeed(instance);
        }), Effect.retry({ schedule: readinessPolicy }));
    });
    return {
        stables: ["dbInstanceArn", "dbInstanceIdentifier"],
        // Pattern (a) AWS account/region collection: `describeDBInstances` is
        // paginated (items: "DBInstances") and returns each instance's
        // `TagList` inline, so we hydrate directly into the same shape `read`
        // produces — no per-item tag fetch needed. An empty/no-instances
        // account simply yields no pages. `DBInstanceNotFoundFault` is in the
        // op's typed error union; treat a stray one as "nothing to list".
        list: () => rds.describeDBInstances.pages({}).pipe(Stream.runCollect, Effect.map((chunk) => Array.from(chunk).flatMap((page) => (page.DBInstances ?? [])
            .filter((instance) => instance.DBInstanceArn != null)
            .map((instance) => toAttrs({
            instance,
            tags: toTagRecord(instance.TagList),
        })))), Effect.catchTag("DBInstanceNotFoundFault", () => Effect.succeed([]))),
        diff: Effect.fn(function* ({ id, olds, news }) {
            if (!isResolved(news))
                return undefined;
            if ((yield* toIdentifier(id, olds ?? {})) !==
                (yield* toIdentifier(id, news))) {
                return { action: "replace" };
            }
            // Immutable props — any change forces a fresh instance.
            if (olds !== undefined &&
                (olds.engine !== news.engine ||
                    olds.dbName !== news.dbName ||
                    olds.masterUsername !== news.masterUsername ||
                    olds.availabilityZone !== news.availabilityZone ||
                    olds.storageEncrypted !== news.storageEncrypted ||
                    olds.kmsKeyId !== news.kmsKeyId ||
                    olds.dbSubnetGroupName !== news.dbSubnetGroupName)) {
                return { action: "replace" };
            }
        }),
        read: Effect.fn(function* ({ id, olds, output }) {
            const identifier = output?.dbInstanceIdentifier ??
                (yield* toIdentifier(id, olds ?? { dbInstanceClass: "", engine: "" }));
            const instance = yield* readInstance(identifier);
            if (!instance?.DBInstanceArn) {
                return undefined;
            }
            return toAttrs({
                instance,
                tags: toTagRecord(instance.TagList),
                // Not observable from AWS — carry the stored deletion behavior
                // and last-sent fingerprint forward so a refresh drops neither.
                skipFinalSnapshot: output?.skipFinalSnapshot,
                finalDBSnapshotIdentifier: output?.finalDBSnapshotIdentifier,
                masterUserPasswordFingerprint: output?.masterUserPasswordFingerprint,
            });
        }),
        reconcile: Effect.fn(function* ({ id, news, output, session }) {
            const identifier = output?.dbInstanceIdentifier ?? (yield* toIdentifier(id, news));
            // AWS never returns the master password, so there is nothing to
            // observe-and-diff — fingerprint the configured value instead and
            // only send `MasterUserPassword` when the fingerprint changed.
            // Without this, every reconcile of an instance whose props carry a
            // password triggers a live `resetting-master-credentials` modify.
            // The hash is salted with the (stable) instance identifier so the
            // persisted digest is not rainbow-table-lookupable, and kept
            // `Redacted` so it never leaks in plaintext through state/logs.
            const passwordFingerprint = news.masterUserPassword !== undefined
                ? Redacted.make(yield* sha256(`${identifier}:${Redacted.value(news.masterUserPassword)}`))
                : undefined;
            const internalTags = yield* createInternalTags(id);
            const desiredTags = { ...internalTags, ...news.tags };
            // Duration props → the exact wire units the RDS API expects.
            const backupRetentionDays = toWireDays(news.backupRetentionPeriod);
            const performanceInsightsRetentionDays = toWireDays(news.performanceInsightsRetentionPeriod);
            const monitoringIntervalSeconds = toWireSeconds(news.monitoringInterval);
            // Observe — fetch live instance state.
            let observed = yield* readInstance(identifier);
            // Ensure — create if missing. Tolerate
            // `DBInstanceAlreadyExistsFault` as a race with a peer reconciler.
            if (!observed?.DBInstanceArn) {
                yield* rds
                    .createDBInstance({
                    DBInstanceIdentifier: identifier,
                    DBClusterIdentifier: news.dbClusterIdentifier,
                    DBInstanceClass: news.dbInstanceClass,
                    Engine: news.engine,
                    EngineVersion: news.engineVersion,
                    DBName: news.dbName,
                    AllocatedStorage: news.allocatedStorage,
                    MaxAllocatedStorage: news.maxAllocatedStorage,
                    StorageType: news.storageType,
                    Iops: news.iops,
                    StorageThroughput: news.storageThroughput,
                    MasterUsername: news.masterUsername,
                    MasterUserPassword: news.masterUserPassword,
                    ManageMasterUserPassword: news.manageMasterUserPassword,
                    MasterUserSecretKmsKeyId: news.masterUserSecretKmsKeyId,
                    Port: news.port,
                    MultiAZ: news.multiAZ,
                    AvailabilityZone: news.availabilityZone,
                    BackupRetentionPeriod: backupRetentionDays,
                    PreferredBackupWindow: news.preferredBackupWindow,
                    PreferredMaintenanceWindow: news.preferredMaintenanceWindow,
                    DBSubnetGroupName: news.dbSubnetGroupName,
                    DBParameterGroupName: news.dbParameterGroupName,
                    OptionGroupName: news.optionGroupName,
                    LicenseModel: news.licenseModel,
                    StorageEncrypted: news.storageEncrypted,
                    KmsKeyId: news.kmsKeyId,
                    CACertificateIdentifier: news.caCertificateIdentifier,
                    EnableIAMDatabaseAuthentication: news.enableIAMDatabaseAuthentication,
                    EnablePerformanceInsights: news.enablePerformanceInsights,
                    PerformanceInsightsKMSKeyId: news.performanceInsightsKMSKeyId,
                    PerformanceInsightsRetentionPeriod: performanceInsightsRetentionDays,
                    MonitoringInterval: monitoringIntervalSeconds,
                    MonitoringRoleArn: news.monitoringRoleArn,
                    EnableCloudwatchLogsExports: news.enableCloudwatchLogsExports,
                    DeletionProtection: news.deletionProtection,
                    NetworkType: news.networkType,
                    // Cluster members inherit VPC security groups from the DB
                    // cluster; passing them fails with InvalidParameterCombination
                    // ("Set vpc security group for the DB Cluster").
                    VpcSecurityGroupIds: news.dbClusterIdentifier
                        ? undefined
                        : news.vpcSecurityGroupIds,
                    PubliclyAccessible: news.publiclyAccessible,
                    PromotionTier: news.promotionTier,
                    AutoMinorVersionUpgrade: news.autoMinorVersionUpgrade,
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
                // from the observed cloud state, to avoid spurious
                // `PendingModifiedValues`. `Port` maps to `DBPortNumber` on modify.
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
                setIf("EngineVersion", news.engineVersion, observed.EngineVersion);
                setIf("AllocatedStorage", news.allocatedStorage, observed.AllocatedStorage); // prettier-ignore
                setIf("MaxAllocatedStorage", news.maxAllocatedStorage, observed.MaxAllocatedStorage); // prettier-ignore
                setIf("StorageType", news.storageType, observed.StorageType);
                setIf("Iops", news.iops, observed.Iops);
                setIf("StorageThroughput", news.storageThroughput, observed.StorageThroughput); // prettier-ignore
                setIf("MultiAZ", news.multiAZ, observed.MultiAZ);
                setIf("BackupRetentionPeriod", backupRetentionDays, observed.BackupRetentionPeriod); // prettier-ignore
                setIf("PreferredBackupWindow", news.preferredBackupWindow, observed.PreferredBackupWindow); // prettier-ignore
                setIf("PreferredMaintenanceWindow", news.preferredMaintenanceWindow, observed.PreferredMaintenanceWindow); // prettier-ignore
                setIf("DBPortNumber", news.port, observed.DbInstancePort);
                setIf("OptionGroupName", news.optionGroupName, undefined);
                setIf("LicenseModel", news.licenseModel, observed.LicenseModel);
                setIf("CACertificateIdentifier", news.caCertificateIdentifier, observed.CACertificateIdentifier); // prettier-ignore
                setIf("EnableIAMDatabaseAuthentication", news.enableIAMDatabaseAuthentication, observed.IAMDatabaseAuthenticationEnabled); // prettier-ignore
                setIf("EnablePerformanceInsights", news.enablePerformanceInsights, observed.PerformanceInsightsEnabled); // prettier-ignore
                setIf("PerformanceInsightsKMSKeyId", news.performanceInsightsKMSKeyId, observed.PerformanceInsightsKMSKeyId); // prettier-ignore
                setIf("PerformanceInsightsRetentionPeriod", performanceInsightsRetentionDays, observed.PerformanceInsightsRetentionPeriod); // prettier-ignore
                setIf("MonitoringInterval", monitoringIntervalSeconds, observed.MonitoringInterval); // prettier-ignore
                setIf("MonitoringRoleArn", news.monitoringRoleArn, observed.MonitoringRoleArn); // prettier-ignore
                setIf("DeletionProtection", news.deletionProtection, observed.DeletionProtection); // prettier-ignore
                setIf("NetworkType", news.networkType, observed.NetworkType);
                setIf("DBParameterGroupName", news.dbParameterGroupName, undefined);
                setIf("PubliclyAccessible", news.publiclyAccessible, observed.PubliclyAccessible); // prettier-ignore
                setIf("PromotionTier", news.promotionTier, observed.PromotionTier);
                setIf("AutoMinorVersionUpgrade", news.autoMinorVersionUpgrade, observed.AutoMinorVersionUpgrade); // prettier-ignore
                setIf("CopyTagsToSnapshot", news.copyTagsToSnapshot, observed.CopyTagsToSnapshot); // prettier-ignore
                // Security groups on Aurora cluster members are managed by the DB
                // cluster (ModifyDBCluster), so only sync them for standalone
                // instances.
                if (news.vpcSecurityGroupIds !== undefined &&
                    news.dbClusterIdentifier === undefined) {
                    core.VpcSecurityGroupIds = news.vpcSecurityGroupIds;
                    coreDirty = true;
                }
                if (news.allowMajorVersionUpgrade) {
                    core.AllowMajorVersionUpgrade = true;
                }
                // syncMasterPassword — rotation or explicit password update. The
                // explicit branch is fingerprint-guarded: send only when the
                // configured password actually changed (or was never
                // fingerprinted — pre-existing state sends once, then records).
                if (news.manageMasterUserPassword &&
                    news.rotateMasterUserPassword) {
                    core.RotateMasterUserPassword = true;
                    coreDirty = true;
                }
                else if (news.masterUserPassword !== undefined &&
                    !sameFingerprint(passwordFingerprint, output?.masterUserPasswordFingerprint)) {
                    core.MasterUserPassword = news.masterUserPassword;
                    coreDirty = true;
                }
                if (coreDirty) {
                    yield* rds.modifyDBInstance(core);
                    observed = yield* waitForInstance(identifier);
                }
                // syncCloudwatchLogsExports — delta-shaped; separate call so it
                // never mixes the full-set fields above.
                const logDelta = logExportDelta(observed.EnabledCloudwatchLogsExports, news.enableCloudwatchLogsExports);
                if (logDelta) {
                    yield* rds.modifyDBInstance({
                        DBInstanceIdentifier: identifier,
                        CloudwatchLogsExportConfiguration: logDelta,
                        ApplyImmediately: true,
                    });
                    observed = yield* waitForInstance(identifier);
                }
            }
            const dbInstanceArn = observed.DBInstanceArn ?? "";
            // Sync tags — diff observed cloud tags against desired.
            const observedTags = toTagRecord(observed.TagList);
            const { removed, upsert } = diffTags(observedTags, desiredTags);
            if (upsert.length > 0 && dbInstanceArn) {
                yield* rds.addTagsToResource({
                    ResourceName: dbInstanceArn,
                    Tags: upsert,
                });
            }
            if (removed.length > 0 && dbInstanceArn) {
                yield* rds.removeTagsFromResource({
                    ResourceName: dbInstanceArn,
                    TagKeys: removed,
                });
            }
            yield* session.note(dbInstanceArn || identifier);
            return toAttrs({
                instance: observed,
                tags: desiredTags,
                skipFinalSnapshot: news.skipFinalSnapshot,
                finalDBSnapshotIdentifier: news.finalDBSnapshotIdentifier,
                masterUserPasswordFingerprint: passwordFingerprint,
            });
        }),
        delete: Effect.fn(function* ({ output }) {
            // Default preserves the existing behavior (no final snapshot). When
            // the resource was declared with `skipFinalSnapshot: false`, take
            // one — timestamped by default so repeated destroy/create cycles
            // never collide on snapshot names.
            const skipFinalSnapshot = output.skipFinalSnapshot ?? true;
            const finalDBSnapshotIdentifier = skipFinalSnapshot
                ? undefined
                : (output.finalDBSnapshotIdentifier ??
                    `${output.dbInstanceIdentifier}-final-${new Date()
                        .toISOString()
                        .replaceAll(/[:.]/g, "-")
                        .toLowerCase()}`);
            yield* rds
                .deleteDBInstance({
                DBInstanceIdentifier: output.dbInstanceIdentifier,
                SkipFinalSnapshot: skipFinalSnapshot,
                FinalDBSnapshotIdentifier: finalDBSnapshotIdentifier,
            })
                .pipe(Effect.catchTag("DBInstanceNotFoundFault", () => Effect.void));
            // Block until the instance is fully gone. RDS deletion is async; if we
            // return while it is still `deleting`, a dependent (e.g. a
            // DBSubnetGroup or VPC) is torn down next and AWS rejects it with
            // `InvalidDBSubnetGroupStateFault: ... still using it`.
            yield* Effect.repeat(rds
                .describeDBInstances({
                DBInstanceIdentifier: output.dbInstanceIdentifier,
            })
                .pipe(Effect.as(true), Effect.catchTag("DBInstanceNotFoundFault", () => Effect.succeed(false))), {
                schedule: Schedule.max([
                    Schedule.fixed("15 seconds"),
                    // A final snapshot serializes before the delete, so give
                    // that path a larger budget than the plain-delete wait.
                    Schedule.recurs(skipFinalSnapshot ? 40 : 80),
                ]),
                until: (exists) => exists === false,
            }).pipe(Effect.catch(() => Effect.void));
        }),
    };
}));
//# sourceMappingURL=DBInstance.js.map