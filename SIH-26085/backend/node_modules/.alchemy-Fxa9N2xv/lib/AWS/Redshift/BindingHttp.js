import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import * as Output from "../../Output.js";
import { isBindingHost } from "../Lambda/Function.js";
/**
 * Shared scaffolding for provisioned Amazon Redshift HTTP bindings.
 *
 * NOT exported from `index.ts` — every `{Op}Http.ts` in this service (except
 * the bespoke `ConnectHttp`) is a thin `Layer.effect(Cap, make…HttpBinding({
 * … }))` over one of the builders below. Everything except the operation,
 * the identifier resolver, and the IAM action list is boilerplate.
 */
/**
 * Build the impl Effect for an account-level operation (cluster discovery,
 * event history, snapshot administration). The deploy-time half grants
 * `actions` on `*` — these operations span every cluster in the account and
 * the identifiers they filter on are runtime data.
 */
export const makeRedshiftAccountHttpBinding = (options) => Effect.gen(function* () {
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
/**
 * Build the impl Effect for a cluster-scoped operation: the runtime callable
 * injects the bound {@link Cluster}'s identifier as `ClusterIdentifier` and
 * the deploy-time half grants `actions` on the cluster ARN (plus any
 * `extraResources`, e.g. the `snapshot:{cluster}/*` ARN pattern for snapshot
 * creation).
 */
export const makeRedshiftClusterHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (cluster) {
        const Identifier = yield* cluster.clusterIdentifier;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                const resources = options.extraResources;
                yield* host.bind `Allow(${host}, ${options.tag}(${cluster}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: resources
                                ? Output.map(cluster.clusterArn, (arn) => [
                                    arn,
                                    ...resources(arn),
                                ])
                                : [Output.interpolate `${cluster.clusterArn}`],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${cluster.LogicalId})`)(function* (request) {
            return yield* op({
                ...request,
                ClusterIdentifier: yield* Identifier,
            });
        });
    });
});
/**
 * The `snapshot:{cluster}/*` ARN derived from a cluster ARN — the extra IAM
 * resource snapshot-writing operations are scoped to.
 */
export const clusterSnapshotArnPattern = (clusterArn) => `${clusterArn.replace(":cluster:", ":snapshot:")}/*`;
//# sourceMappingURL=BindingHttp.js.map