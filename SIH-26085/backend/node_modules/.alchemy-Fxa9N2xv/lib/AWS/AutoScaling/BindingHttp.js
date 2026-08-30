import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import { isInstance } from "../EC2/Instance.js";
import { isBindingHost } from "../Lambda/Function.js";
/**
 * Shared scaffolding for EC2 Auto Scaling HTTP bindings.
 *
 * NOT exported from `index.ts` — every single-operation `{Op}Http.ts` in this
 * service is a thin `Layer.effect(Cap, makeGroupHttpBinding({ … }))` over the
 * builder below. Everything except the operation and the IAM action list is
 * boilerplate: the runtime callable injects the bound
 * {@link AutoScalingGroup}'s `AutoScalingGroupName` into the request (the
 * serializer drops the field for the few operations that do not accept it —
 * those are authorized against the instance's owning group) and the
 * deploy-time half grants `actions` on the group ARN, or on `*` for
 * `Describe*` actions (EC2 Auto Scaling `Describe*` actions do not support
 * resource-level permissions).
 *
 * Genuinely-different bindings (multi-operation clients like
 * `CompleteLifecycleAction`, `Standby`, and `InstanceRefresh`, or custom
 * request shaping like `DescribeAutoScalingGroup`) stay bespoke.
 */
export const makeGroupHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (group) {
        const AutoScalingGroupName = yield* group.autoScalingGroupName;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host) || isInstance(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${group}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: options.resource === "*"
                                ? ["*"]
                                : [group.autoScalingGroupArn],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${group.LogicalId})`)(function* (request) {
            return yield* op({
                ...request,
                AutoScalingGroupName: yield* AutoScalingGroupName,
            });
        });
    });
});
//# sourceMappingURL=BindingHttp.js.map