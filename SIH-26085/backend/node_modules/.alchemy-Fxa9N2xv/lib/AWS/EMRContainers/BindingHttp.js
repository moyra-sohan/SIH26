import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import * as Output from "../../Output.js";
import { isBindingHost } from "../Lambda/Function.js";
/**
 * Shared scaffolding for Amazon EMR on EKS (`emr-containers`) HTTP bindings.
 *
 * NOT exported from `index.ts` — every thin `{Op}Http.ts` in this service is
 * a `Layer.effect(Cap, make…HttpBinding({ … }))` over one of the builders
 * below. Everything except the operation, the identifier injection, and the
 * IAM action list is boilerplate.
 *
 * EMR on EKS authorizes virtual-cluster-addressed actions against the
 * virtual cluster ARN (`arn:…:/virtualclusters/vc-id`) and sub-resource
 * actions (job runs, managed endpoints) against child ARNs
 * (`…/virtualclusters/vc-id/jobruns/id`, `…/endpoints/id`), so the
 * virtual-cluster builders grant on both the bound cluster's ARN and its
 * sub-resource pattern.
 */
export const virtualClusterPolicyStatement = (virtualCluster, actions) => ({
    Effect: "Allow",
    Action: [...actions],
    Resource: [
        Output.interpolate `${virtualCluster.virtualClusterArn}`,
        Output.map(virtualCluster.virtualClusterArn, (arn) => `${arn}/*`),
    ],
});
/**
 * Build the impl Effect for an operation whose input carries a
 * `virtualClusterId` field: the runtime callable injects the bound
 * {@link VirtualCluster}'s ID and the deploy-time half grants `actions` on
 * the virtual cluster ARN (and its sub-resource pattern).
 */
export const makeEMRContainersVirtualClusterHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (virtualCluster) {
        // Outputs yield a DEFERRED effect — resolve again per invocation below.
        const VirtualClusterId = yield* virtualCluster.virtualClusterId;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${virtualCluster}))`({
                    policyStatements: [
                        virtualClusterPolicyStatement(virtualCluster, options.actions),
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${virtualCluster.LogicalId})`)(function* (request) {
            return yield* op({
                ...request,
                virtualClusterId: yield* VirtualClusterId,
            });
        });
    });
});
/**
 * Build the impl Effect for an operation whose input carries an `id` field
 * addressing a {@link JobTemplate}: the runtime callable injects the bound
 * template's ID and the deploy-time half grants `actions` on the template
 * ARN.
 */
export const makeEMRContainersJobTemplateHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (template) {
        const JobTemplateId = yield* template.jobTemplateId;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${template}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: [template.jobTemplateArn],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${template.LogicalId})`)(function* (request) {
            return yield* op({ ...request, id: yield* JobTemplateId });
        });
    });
});
/**
 * Build the impl Effect for an account-level operation (e.g. enumerating the
 * account's job templates). The deploy-time half grants `actions` on `*` —
 * account-level list actions are not scoped to a single resource.
 */
export const makeEMRContainersAccountHttpBinding = (options) => Effect.gen(function* () {
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