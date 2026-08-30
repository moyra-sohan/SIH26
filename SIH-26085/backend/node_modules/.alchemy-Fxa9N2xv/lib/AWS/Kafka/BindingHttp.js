import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import * as Output from "../../Output.js";
import { isBindingHost } from "../Lambda/Function.js";
/**
 * Shared scaffolding for AWS MSK (Kafka) HTTP bindings.
 *
 * NOT exported from `index.ts` — every `{Op}Http.ts` in this service is a
 * thin `Layer.effect(Cap, makeKafkaClusterHttpBinding({ … }))` over the
 * builder below. Everything except the operation and the IAM action list is
 * boilerplate.
 */
/**
 * The cluster ARN is `arn:…:cluster/name/uuid`. Topic resources live under a
 * sibling `topic/` namespace scoped to the same cluster path; both the
 * `kafka:*Topic*` control-plane actions and the `kafka-cluster:*` data-plane
 * actions authorize against these ARNs.
 */
export const topicArnGlob = (clusterArn) => `${clusterArn.replace(":cluster/", ":topic/")}/*`;
/** Consumer-group ARNs under the cluster's `group/` namespace. */
export const groupArnGlob = (clusterArn) => `${clusterArn.replace(":cluster/", ":group/")}/*`;
/** Transactional-id ARNs under the cluster's `transactional-id/` namespace. */
export const transactionalIdArnGlob = (clusterArn) => `${clusterArn.replace(":cluster/", ":transactional-id/")}/*`;
/**
 * Build the impl Effect for a cluster-scoped MSK control-plane operation: the
 * runtime callable injects the bound {@link ServerlessCluster}'s ARN as
 * `ClusterArn` and the deploy-time half grants `actions` on the cluster ARN
 * (plus the cluster's `topic/` ARN namespace when `topicScoped` is set —
 * topic-management actions authorize against topic ARNs).
 */
export const makeKafkaClusterHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (cluster) {
        const ClusterArn = yield* cluster.clusterArn;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${cluster}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: options.topicScoped
                                ? [
                                    Output.interpolate `${cluster.clusterArn}`,
                                    cluster.clusterArn.pipe(Output.map(topicArnGlob)),
                                ]
                                : [Output.interpolate `${cluster.clusterArn}`],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${cluster.LogicalId})`)(function* (request) {
            return yield* op({
                ...request,
                ClusterArn: yield* ClusterArn,
            });
        });
    });
});
//# sourceMappingURL=BindingHttp.js.map