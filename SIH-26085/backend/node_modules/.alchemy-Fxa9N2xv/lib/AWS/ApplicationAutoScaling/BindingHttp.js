import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import { isBindingHost } from "../Lambda/Function.js";
/**
 * Build the impl Effect for a scalable-target-scoped operation: the runtime
 * callable injects the bound {@link ScalableTarget}'s identity triple and the
 * deploy-time half grants `actions` on `*`.
 */
export const makeTargetScopedHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (target) {
        const ServiceNamespace = yield* target.serviceNamespace;
        const ResourceId = yield* target.resourceId;
        const ScalableDimension = yield* target.scalableDimension;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${target}))`({
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
        return Effect.fn(`${options.tag}(${target.LogicalId})`)(function* (request) {
            return yield* op({
                ...request,
                ServiceNamespace: yield* ServiceNamespace,
                ResourceId: yield* ResourceId,
                ScalableDimension: yield* ScalableDimension,
            });
        });
    });
});
/**
 * Build the impl Effect for a scaling-policy-scoped operation: the runtime
 * callable injects the bound {@link ScalingPolicy}'s identity triple and
 * `PolicyName`, and the deploy-time half grants `actions` on `*`.
 */
export const makePolicyScopedHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (policy) {
        const ServiceNamespace = yield* policy.serviceNamespace;
        const ResourceId = yield* policy.resourceId;
        const ScalableDimension = yield* policy.scalableDimension;
        const PolicyName = yield* policy.policyName;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${policy}))`({
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
        return Effect.fn(`${options.tag}(${policy.LogicalId})`)(function* (request) {
            return yield* op({
                ...request,
                ServiceNamespace: yield* ServiceNamespace,
                ResourceId: yield* ResourceId,
                ScalableDimension: yield* ScalableDimension,
                PolicyName: yield* PolicyName,
            });
        });
    });
});
//# sourceMappingURL=BindingHttp.js.map