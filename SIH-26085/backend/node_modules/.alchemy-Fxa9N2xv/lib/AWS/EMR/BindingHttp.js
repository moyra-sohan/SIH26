import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import * as Output from "../../Output.js";
import { isBindingHost } from "../Lambda/Function.js";
/**
 * Shared scaffolding for Amazon EMR HTTP bindings.
 *
 * NOT exported from `index.ts` — every `{Op}Http.ts` in this service is a
 * thin `Layer.effect(Cap, make…HttpBinding({ … }))` over one of the two
 * builders below. Everything except the operation, the IAM action list, and
 * the injected cluster identifier is boilerplate.
 */
/**
 * Build the impl Effect for a cluster-scoped operation. The deploy-time half
 * grants `actions` on the bound {@link Cluster}'s ARN (EMR authorizes
 * cluster-addressed actions against the cluster ARN); the runtime callable
 * injects the cluster's identifier into the request as `inject`:
 *
 * - `"ClusterId"` (default) / `"JobFlowId"` — the cluster id (`j-…`)
 * - `"TargetResourceArn"` — the cluster ARN (persistent app UIs)
 * - `"none"` — pass the caller's request through unchanged (id-addressed
 *   companions like `DescribePersistentAppUI` that EMR still authorizes
 *   against the cluster the target belongs to)
 */
export const makeEmrClusterHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    const inject = options.inject ?? "ClusterId";
    return Effect.fn(function* (cluster) {
        // Outputs yield a DEFERRED effect — resolve again per invocation below.
        const Injected = yield* inject === "TargetResourceArn"
            ? cluster.clusterArn
            : cluster.clusterId;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${cluster}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: [Output.interpolate `${cluster.clusterArn}`],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${cluster.LogicalId})`)(function* (request) {
            return yield* op((inject === "none"
                ? { ...request }
                : { ...request, [inject]: yield* Injected }));
        });
    });
});
/**
 * Build the impl Effect for an account-level operation (cluster inventory,
 * release-label catalog). The deploy-time half grants `actions` on `*` —
 * these read-only discovery actions span every cluster/release label in the
 * account and support no resource-level scoping.
 */
export const makeEmrAccountHttpBinding = (options) => Effect.gen(function* () {
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
                            Resource: ["*"],
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
//# sourceMappingURL=BindingHttp.js.map