import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import * as Output from "../../Output.js";
import { isBindingHost } from "../Lambda/Function.js";
import { groupArnGlob, topicArnGlob, transactionalIdArnGlob, } from "./BindingHttp.js";
import { connectEnvPrefix } from "./Connect.js";
/**
 * Shared scaffolding for the MSK connect bindings.
 *
 * NOT exported from `index.ts` — `ConnectReadHttp.ts` / `ConnectWriteHttp.ts`
 * / `ConnectReadWriteHttp.ts` are thin
 * `Layer.effect(Cap, makeKafkaConnectHttpBinding({ … }))` calls over the
 * builder below. Only the IAM action sets differ per access level.
 */
/** Cluster-level actions every MSK IAM-auth client needs. */
export const KAFKA_CONNECT_ACTIONS = [
    "kafka-cluster:Connect",
    "kafka-cluster:DescribeCluster",
    "kafka-cluster:DescribeClusterDynamicConfiguration",
];
/** Topic-level consumer actions. */
export const KAFKA_READ_TOPIC_ACTIONS = [
    "kafka-cluster:DescribeTopic",
    "kafka-cluster:ReadData",
];
/** Consumer-group actions (join a group, commit offsets). */
export const KAFKA_READ_GROUP_ACTIONS = [
    "kafka-cluster:DescribeGroup",
    "kafka-cluster:AlterGroup",
];
/** Topic-level producer actions. */
export const KAFKA_WRITE_TOPIC_ACTIONS = [
    "kafka-cluster:DescribeTopic",
    "kafka-cluster:WriteData",
];
/** Cluster-level producer actions (idempotent producers). */
export const KAFKA_WRITE_CLUSTER_ACTIONS = [
    "kafka-cluster:WriteDataIdempotently",
];
/** Transactional-id actions (transactional producers). */
export const KAFKA_WRITE_TRANSACTION_ACTIONS = [
    "kafka-cluster:DescribeTransactionalId",
    "kafka-cluster:AlterTransactionalId",
];
/**
 * Build the impl Effect for a connect binding. At deploy time it grants the
 * given action sets on the cluster / topic / group / transactional-id ARN
 * namespaces and publishes the SASL/IAM bootstrap endpoint as
 * `MSK_{LOGICAL_ID}_{BROKERS,ARN}` environment variables on the host
 * Function; at runtime it resolves the same values into a typed connection
 * descriptor.
 */
export const makeKafkaConnectHttpBinding = (options) => Effect.gen(function* () {
    return Effect.fn(function* (cluster) {
        const BootstrapServers = yield* cluster.bootstrapBrokerStringSaslIam;
        const ClusterArn = yield* cluster.clusterArn;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                const prefix = connectEnvPrefix(cluster.LogicalId);
                yield* host.bind `Allow(${host}, ${options.tag}(${cluster}))`({
                    env: {
                        [`${prefix}_BROKERS`]: cluster.bootstrapBrokerStringSaslIam,
                        [`${prefix}_ARN`]: cluster.clusterArn,
                    },
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.clusterActions],
                            Resource: [Output.interpolate `${cluster.clusterArn}`],
                        },
                        {
                            Effect: "Allow",
                            Action: [...options.topicActions],
                            Resource: [cluster.clusterArn.pipe(Output.map(topicArnGlob))],
                        },
                        ...(options.groupActions?.length
                            ? [
                                {
                                    Effect: "Allow",
                                    Action: [...options.groupActions],
                                    Resource: [
                                        cluster.clusterArn.pipe(Output.map(groupArnGlob)),
                                    ],
                                },
                            ]
                            : []),
                        ...(options.transactionActions?.length
                            ? [
                                {
                                    Effect: "Allow",
                                    Action: [...options.transactionActions],
                                    Resource: [
                                        cluster.clusterArn.pipe(Output.map(transactionalIdArnGlob)),
                                    ],
                                },
                            ]
                            : []),
                    ],
                });
            }
        }
        return Effect.gen(function* () {
            const bootstrapServers = yield* BootstrapServers;
            const clusterArn = yield* ClusterArn;
            if (!bootstrapServers) {
                return yield* Effect.die(`MSK SASL/IAM bootstrap brokers for '${cluster.LogicalId}' are not available yet`);
            }
            return {
                bootstrapServers,
                brokers: bootstrapServers.split(","),
                clusterArn,
                authentication: "iam",
            };
        });
    });
});
//# sourceMappingURL=ConnectHttp.js.map