import * as autoscaling from "@distilled.cloud/aws/auto-scaling";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Binding from "../../Binding.js";
import { isInstance } from "../EC2/Instance.js";
import { isBindingHost } from "../Lambda/Function.js";
import { CompleteLifecycleAction, } from "./CompleteLifecycleAction.js";
export const CompleteLifecycleActionHttp = Layer.effect(CompleteLifecycleAction, Effect.gen(function* () {
    const complete = yield* autoscaling.completeLifecycleAction;
    const heartbeat = yield* autoscaling.recordLifecycleActionHeartbeat;
    return Effect.fn(function* (group) {
        const AutoScalingGroupName = yield* group.autoScalingGroupName;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host) || isInstance(host)) {
                yield* host.bind `Allow(${host}, AWS.AutoScaling.CompleteLifecycleAction(${group}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [
                                "autoscaling:CompleteLifecycleAction",
                                "autoscaling:RecordLifecycleActionHeartbeat",
                            ],
                            Resource: [group.autoScalingGroupArn],
                        },
                    ],
                });
            }
        }
        return {
            complete: Effect.fn(`AWS.AutoScaling.CompleteLifecycleAction(${group.LogicalId})`)(function* (request) {
                return yield* complete({
                    ...request,
                    AutoScalingGroupName: yield* AutoScalingGroupName,
                });
            }),
            heartbeat: Effect.fn(`AWS.AutoScaling.RecordLifecycleActionHeartbeat(${group.LogicalId})`)(function* (request) {
                return yield* heartbeat({
                    ...request,
                    AutoScalingGroupName: yield* AutoScalingGroupName,
                });
            }),
        };
    });
}));
//# sourceMappingURL=CompleteLifecycleActionHttp.js.map