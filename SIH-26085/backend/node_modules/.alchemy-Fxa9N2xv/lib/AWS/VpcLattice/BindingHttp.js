import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import * as Output from "../../Output.js";
import { isBindingHost } from "../Lambda/Function.js";
/**
 * Shared scaffolding for the VPC Lattice runtime bindings.
 *
 * NOT exported from `index.ts` — every `{Op}Http.ts` in this service is a
 * thin `Layer.effect(Cap, makeVpcLatticeTargetGroupHttpBinding({ … }))` over
 * the builder below. Everything except the operation, the IAM action list,
 * and the injected `targetGroupIdentifier` is boilerplate.
 */
/**
 * Build the impl Effect for a target-group-scoped VPC Lattice operation: the
 * runtime callable injects the bound {@link TargetGroup}'s ID as
 * `targetGroupIdentifier` and the deploy-time half grants `actions` on the
 * target group's ARN.
 */
export const makeVpcLatticeTargetGroupHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (targetGroup) {
        const targetGroupIdentifier = yield* targetGroup.targetGroupId;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${targetGroup}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: [Output.interpolate `${targetGroup.targetGroupArn}`],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${targetGroup.LogicalId})`)(function* (request) {
            return yield* op({
                ...request,
                targetGroupIdentifier: yield* targetGroupIdentifier,
            });
        });
    });
});
//# sourceMappingURL=BindingHttp.js.map