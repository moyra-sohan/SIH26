import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import * as Output from "../../Output.js";
import { isBindingHost } from "../Lambda/Function.js";
/**
 * Shared scaffolding for AWS DocDBElastic HTTP bindings.
 *
 * NOT exported from `index.ts` — every `{Op}Http.ts` in this service is a
 * thin `Layer.effect(Cap, make…HttpBinding({ … }))` over one of the builders
 * below. Everything except the operation and the IAM action list is
 * boilerplate.
 */
/**
 * Elastic-cluster snapshot ARNs embed a server-generated UUID that is only
 * known at runtime, so snapshot-scoped grants use this wildcard.
 */
export const SNAPSHOT_ARN_WILDCARD = "arn:aws:docdb-elastic:*:*:cluster-snapshot/*";
/**
 * Build the impl Effect for an account-level operation (snapshot management,
 * restore, pending maintenance). The deploy-time half grants `actions` on
 * `resources` (default `*`) — these operations address snapshots and
 * clusters by ARNs that are runtime data.
 */
export const makeDocDBElasticAccountHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* () {
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}())`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: [...(options.resources ?? ["*"])],
                        },
                    ],
                });
            }
        }
        return Effect.fn(options.tag)(function* (request) {
            return yield* op((request ?? {}));
        });
    });
});
/**
 * Build the impl Effect for a cluster-scoped operation: the runtime callable
 * injects the bound {@link Cluster}'s ARN as `clusterArn` and the deploy-time
 * half grants `actions` on the cluster ARN (plus any `extraResources`).
 */
export const makeDocDBElasticClusterHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (cluster) {
        const clusterArn = yield* cluster.clusterArn;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${cluster}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: [
                                Output.interpolate `${cluster.clusterArn}`,
                                ...(options.extraResources ?? []),
                            ],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${cluster.LogicalId})`)(function* (request) {
            return yield* op({
                ...request,
                clusterArn: yield* clusterArn,
            });
        });
    });
});
//# sourceMappingURL=BindingHttp.js.map