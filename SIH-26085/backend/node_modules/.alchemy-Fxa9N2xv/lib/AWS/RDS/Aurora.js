import * as Effect from "effect/Effect";
import * as Redacted from "effect/Redacted";
import { toWireSeconds } from "../../Util/Duration.js";
import * as Namespace from "../../Namespace.js";
import * as IAM from "../IAM/index.js";
import { Secret, } from "../SecretsManager/Secret.js";
import { DBCluster, } from "./DBCluster.js";
import { DBClusterParameterGroup, } from "./DBClusterParameterGroup.js";
import { DBInstance, } from "./DBInstance.js";
import { DBParameterGroup, } from "./DBParameterGroup.js";
import { DBProxy, } from "./DBProxy.js";
import { DBProxyEndpoint, } from "./DBProxyEndpoint.js";
import { DBProxyTargetGroup, } from "./DBProxyTargetGroup.js";
import { DBSubnetGroup, } from "./DBSubnetGroup.js";
const mergeTags = (base, extra) => ({
    ...base,
    ...extra,
});
const inferProxyEngineFamily = (engine) => {
    if (engine.includes("postgres")) {
        return "POSTGRESQL";
    }
    if (engine.includes("mysql")) {
        return "MYSQL";
    }
    return "POSTGRESQL";
};
/**
 * Opinionated Aurora bring-up helper.
 *
 * `Aurora` is the fast-start L2 for getting a working database online with one
 * call. It creates a generated admin secret, DB subnet group, Aurora cluster,
 * and a single writer instance by default. Optional readers, parameter groups,
 * and an auto-wired RDS Proxy can be enabled as needs grow.
 *
 * The return value intentionally exposes the underlying `DB*` resources so
 * users can expand into the lower-level surface without rewriting the stack.
 * ### Creating a Database
 * **Example:** Start a Small Aurora Cluster
 * ```typescript
 * const db = yield* AWS.RDS.Aurora("AppDb", {
 *   subnetIds: [privateSubnetA.subnetId, privateSubnetB.subnetId],
 *   securityGroupIds: [databaseSecurityGroup.groupId],
 * });
 * ```
 *
 * ### Scaling Out
 * **Example:** Add Readers and a Proxy
 * ```typescript
 * const db = yield* AWS.RDS.Aurora("AppDb", {
 *   subnetIds: [privateSubnetA.subnetId, privateSubnetB.subnetId],
 *   securityGroupIds: [databaseSecurityGroup.groupId],
 *   readers: 2,
 *   proxy: true,
 * });
 * ```
 *
 * ### Querying from a Function
 * **Example:** Query over the Data API
 * ```typescript
 * // the Data API is enabled by default (dataApi: true) — bind
 * // AWS.RDSData.ExecuteStatement to query without a VPC socket
 * const executeStatement = yield* AWS.RDSData.ExecuteStatement(db.cluster, {
 *   secret: db.secret,
 *   database: "app",
 * });
 * const result = yield* executeStatement({ sql: "SELECT 1" });
 * ```
 *
 * @resource
 */
export const Aurora = (id, props) => Namespace.push(id, Effect.gen(function* () {
    const engine = props.engine ?? "aurora-postgresql";
    const engineVersion = props.engineVersion;
    const databaseName = props.databaseName ?? "app";
    const username = props.secret?.username ?? "app";
    const subnetIds = props.subnetIds;
    const securityGroupIds = props.securityGroupIds;
    const commonTags = props.tags;
    const proxyConfig = props.proxy === true ? {} : props.proxy || undefined;
    const secret = props.secret?.resource ??
        (yield* Secret("Secret", {
            name: props.secret?.name,
            description: props.secret?.description ??
                `Credentials for Aurora database ${id}`,
            kmsKeyId: props.secret?.kmsKeyId,
            secretString: props.secret?.secretString,
            secretBinary: props.secret?.secretBinary,
            generateSecretString: props.secret?.secretString || props.secret?.secretBinary
                ? undefined
                : {
                    secretStringTemplate: JSON.stringify({ username }),
                    generateStringKey: "password",
                    PasswordLength: 32,
                    ExcludeCharacters: "\"'@/\\",
                    ...props.secret?.generateSecretString,
                },
            tags: mergeTags(commonTags, props.secret?.tags),
        }));
    const subnetGroup = yield* DBSubnetGroup("SubnetGroup", {
        dbSubnetGroupName: props.subnetGroup?.dbSubnetGroupName,
        description: props.subnetGroup?.description,
        subnetIds,
        tags: mergeTags(commonTags, props.subnetGroup?.tags),
    });
    const clusterParameterGroup = props.clusterParameterGroup
        ? yield* DBClusterParameterGroup("ClusterParameterGroup", {
            dbClusterParameterGroupName: props.clusterParameterGroup.dbClusterParameterGroupName,
            family: props.clusterParameterGroup.family,
            description: props.clusterParameterGroup.description,
            tags: mergeTags(commonTags, props.clusterParameterGroup.tags),
        })
        : undefined;
    const parameterGroup = props.parameterGroup
        ? yield* DBParameterGroup("ParameterGroup", {
            dbParameterGroupName: props.parameterGroup.dbParameterGroupName,
            family: props.parameterGroup.family,
            description: props.parameterGroup.description,
            tags: mergeTags(commonTags, props.parameterGroup.tags),
        })
        : undefined;
    // Enhanced-monitoring role: reuse an explicit ARN, otherwise auto-create
    // one when a non-zero interval is requested.
    const monitoringInterval = props.monitoring?.interval;
    const monitoringRole = monitoringInterval !== undefined &&
        (toWireSeconds(monitoringInterval) ?? 0) > 0 &&
        !props.monitoring?.roleArn
        ? yield* IAM.Role("MonitoringRole", {
            assumeRolePolicyDocument: {
                Version: "2012-10-17",
                Statement: [
                    {
                        Effect: "Allow",
                        Principal: { Service: "monitoring.rds.amazonaws.com" },
                        Action: ["sts:AssumeRole"],
                        Resource: ["*"],
                    },
                ],
            },
            managedPolicyArns: [
                "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole",
            ],
            tags: mergeTags(commonTags, undefined),
        })
        : undefined;
    const monitoringRoleArn = props.monitoring?.roleArn ?? monitoringRole?.roleArn; // prettier-ignore
    const cluster = yield* DBCluster("Cluster", {
        engine,
        engineVersion,
        databaseName,
        dbSubnetGroupName: subnetGroup.dbSubnetGroupName,
        dbClusterParameterGroupName: clusterParameterGroup?.dbClusterParameterGroupName,
        vpcSecurityGroupIds: securityGroupIds,
        enableHttpEndpoint: props.dataApi ?? true,
        copyTagsToSnapshot: props.cluster?.copyTagsToSnapshot ?? true,
        deletionProtection: props.cluster?.deletionProtection ??
            props.deletionProtection ??
            false,
        backupRetentionPeriod: props.cluster?.backupRetentionPeriod ?? props.backupRetentionPeriod,
        preferredBackupWindow: props.cluster?.preferredBackupWindow ?? props.preferredBackupWindow,
        preferredMaintenanceWindow: props.cluster?.preferredMaintenanceWindow ??
            props.preferredMaintenanceWindow,
        storageEncrypted: props.cluster?.storageEncrypted ?? props.storageEncrypted,
        kmsKeyId: props.cluster?.kmsKeyId ?? props.kmsKeyId,
        enableIAMDatabaseAuthentication: props.cluster?.enableIAMDatabaseAuthentication ??
            props.enableIAMDatabaseAuthentication,
        enableCloudwatchLogsExports: props.cluster?.enableCloudwatchLogsExports ??
            props.enableCloudwatchLogsExports,
        caCertificateIdentifier: props.cluster?.caCertificateIdentifier ??
            props.caCertificateIdentifier,
        port: props.cluster?.port ?? props.port,
        backtrackWindow: props.cluster?.backtrackWindow ?? props.backtrackWindow,
        monitoringInterval: props.cluster?.monitoringInterval ?? monitoringInterval,
        monitoringRoleArn: props.cluster?.monitoringRoleArn ?? monitoringRoleArn,
        enablePerformanceInsights: props.cluster?.enablePerformanceInsights ??
            props.monitoring?.performanceInsights,
        serverlessV2ScalingConfiguration: props.cluster?.serverlessV2ScalingConfiguration ??
            (props.scaling
                ? {
                    MinCapacity: props.scaling.minCapacity ?? 0.5,
                    MaxCapacity: props.scaling.maxCapacity ?? 1,
                }
                : {
                    MinCapacity: 0.5,
                    MaxCapacity: 1,
                }),
        masterUserSecretArn: secret.secretArn,
        tags: mergeTags(commonTags, props.cluster?.tags),
        ...props.cluster,
    });
    const defaultInstanceClass = props.instance?.dbInstanceClass ??
        props.instanceClass ??
        "db.serverless";
    const writer = yield* DBInstance("Writer", {
        dbClusterIdentifier: cluster.dbClusterIdentifier,
        dbInstanceClass: defaultInstanceClass,
        engine,
        engineVersion,
        dbSubnetGroupName: subnetGroup.dbSubnetGroupName,
        dbParameterGroupName: parameterGroup?.dbParameterGroupName,
        // No vpcSecurityGroupIds: cluster members inherit security groups from
        // the DB cluster. Passing them here fails with "The requested DB
        // Instance will be a member of a DB Cluster. Set vpc security group
        // for the DB Cluster."
        publiclyAccessible: props.instance?.publiclyAccessible ?? false,
        promotionTier: props.instance?.promotionTier ?? 0,
        autoMinorVersionUpgrade: props.instance?.autoMinorVersionUpgrade ?? true,
        copyTagsToSnapshot: props.instance?.copyTagsToSnapshot ?? true,
        monitoringInterval: props.instance?.monitoringInterval ?? monitoringInterval, // prettier-ignore
        monitoringRoleArn: props.instance?.monitoringRoleArn ?? monitoringRoleArn,
        enablePerformanceInsights: props.instance?.enablePerformanceInsights ??
            props.monitoring?.performanceInsights,
        tags: mergeTags(commonTags, props.instance?.tags),
        ...props.instance,
    });
    const readers = yield* Effect.all(Array.from({ length: props.readers ?? 0 }, (_, index) => DBInstance(`Reader${index + 1}`, {
        dbClusterIdentifier: cluster.dbClusterIdentifier,
        dbInstanceClass: defaultInstanceClass,
        engine,
        engineVersion,
        dbSubnetGroupName: subnetGroup.dbSubnetGroupName,
        dbParameterGroupName: parameterGroup?.dbParameterGroupName,
        // No vpcSecurityGroupIds: security groups belong on the DB
        // cluster, not its member instances (see Writer above).
        publiclyAccessible: props.instance?.publiclyAccessible ?? false,
        promotionTier: index + 1,
        autoMinorVersionUpgrade: props.instance?.autoMinorVersionUpgrade ?? true,
        copyTagsToSnapshot: props.instance?.copyTagsToSnapshot ?? true,
        monitoringInterval: props.instance?.monitoringInterval ?? monitoringInterval, // prettier-ignore
        monitoringRoleArn: props.instance?.monitoringRoleArn ?? monitoringRoleArn,
        enablePerformanceInsights: props.instance?.enablePerformanceInsights ??
            props.monitoring?.performanceInsights,
        tags: mergeTags(commonTags, props.instance?.tags),
        ...props.instance,
    })), { concurrency: "unbounded" });
    const proxy = proxyConfig === undefined
        ? undefined
        : yield* Effect.gen(function* () {
            const role = yield* IAM.Role("ProxyRole", {
                assumeRolePolicyDocument: {
                    Version: "2012-10-17",
                    Statement: [
                        {
                            Effect: "Allow",
                            Principal: {
                                Service: "rds.amazonaws.com",
                            },
                            Action: ["sts:AssumeRole"],
                            Resource: ["*"],
                        },
                    ],
                },
                inlinePolicies: {
                    ReadSecret: {
                        Version: "2012-10-17",
                        Statement: [
                            {
                                Effect: "Allow",
                                Action: [
                                    "secretsmanager:GetSecretValue",
                                    "secretsmanager:DescribeSecret",
                                ],
                                Resource: [secret.secretArn],
                            },
                        ],
                    },
                },
                tags: mergeTags(commonTags, undefined),
            });
            const proxy = yield* DBProxy("Proxy", {
                dbProxyName: proxyConfig.dbProxyName,
                engineFamily: inferProxyEngineFamily(engine),
                auth: proxyConfig.auth ?? [
                    {
                        AuthScheme: "SECRETS",
                        SecretArn: secret.secretArn,
                        IAMAuth: "DISABLED",
                    },
                ],
                roleArn: role.roleArn,
                vpcSubnetIds: subnetIds,
                vpcSecurityGroupIds: securityGroupIds,
                requireTLS: proxyConfig.requireTLS ?? true,
                idleClientTimeout: proxyConfig.idleClientTimeout,
                debugLogging: proxyConfig.debugLogging,
                endpointNetworkType: proxyConfig.endpointNetworkType,
                targetConnectionNetworkType: proxyConfig.targetConnectionNetworkType,
                tags: mergeTags(commonTags, proxyConfig.tags),
            });
            const targetGroup = yield* DBProxyTargetGroup("ProxyTargetGroup", {
                targetGroupName: proxyConfig.targetGroup?.targetGroupName,
                dbProxyName: proxy.dbProxyName,
                dbClusterIdentifiers: [cluster.dbClusterIdentifier],
                dbInstanceIdentifiers: proxyConfig.targetGroup?.dbInstanceIdentifiers,
                connectionPoolConfig: proxyConfig.targetGroup?.connectionPoolConfig,
            });
            const endpoint = proxyConfig.endpoint === undefined
                ? undefined
                : yield* DBProxyEndpoint("ProxyEndpoint", {
                    dbProxyName: proxy.dbProxyName,
                    vpcSubnetIds: subnetIds,
                    vpcSecurityGroupIds: securityGroupIds,
                    ...(proxyConfig.endpoint === true
                        ? {}
                        : proxyConfig.endpoint),
                    tags: mergeTags(commonTags, proxyConfig.endpoint === true
                        ? undefined
                        : proxyConfig.endpoint.tags),
                });
            return {
                role,
                proxy,
                targetGroup,
                endpoint,
            };
        });
    return {
        secret,
        subnetGroup,
        clusterParameterGroup,
        parameterGroup,
        cluster,
        writer,
        readers,
        instances: [writer, ...readers],
        proxy,
    };
}));
//# sourceMappingURL=Aurora.js.map