import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import * as Output from "../../Output.js";
import { isBindingHost } from "../Lambda/Function.js";
/**
 * Shared scaffolding for AWS EKS HTTP bindings.
 *
 * NOT exported from `index.ts` — every `{Op}Http.ts` in this service is a
 * thin `Layer.effect(Cap, makeEKS…HttpBinding({ … }))` over one of the
 * builders below. Everything except the operation, the request key carrying
 * the cluster name, and the IAM action list is boilerplate.
 */
/**
 * Build the impl Effect for an account-level operation (cluster enumeration,
 * managed access-policy catalog, Kubernetes/add-on version catalogs). The
 * deploy-time half grants `actions` on `*` — these read-only catalog and
 * enumeration actions span the whole account/region and take no resource ARN.
 */
export const makeEKSAccountHttpBinding = (options) => Effect.gen(function* () {
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
const scopeResources = (cluster, scope) => {
    const clusterArn = Output.interpolate `${cluster.clusterArn}`;
    const subresources = Output.map(cluster.clusterArn, (arn) => `${arn.replace(":cluster/", ":*/")}/*`);
    return scope === "cluster"
        ? [clusterArn]
        : scope === "subresources"
            ? [subresources]
            : [clusterArn, subresources];
};
/**
 * Build the impl Effect for a cluster-scoped operation: the runtime callable
 * injects the bound {@link Cluster}'s name under `key` (`clusterName` for the
 * sub-resource lists and insights, `name` for `DescribeCluster`) and the
 * deploy-time half grants `actions` on the cluster ARN and/or its
 * sub-resource ARNs per `scope`.
 */
export const makeEKSClusterHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (cluster) {
        const clusterName = yield* cluster.clusterName;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${cluster}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: scopeResources(cluster, options.scope),
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${cluster.LogicalId})`)(function* (request) {
            return yield* op({
                ...request,
                [options.key]: yield* clusterName,
            });
        });
    });
});
//# sourceMappingURL=BindingHttp.js.map