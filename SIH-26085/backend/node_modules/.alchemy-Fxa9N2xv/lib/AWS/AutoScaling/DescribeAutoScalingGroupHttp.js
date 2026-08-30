import * as autoscaling from "@distilled.cloud/aws/auto-scaling";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Binding from "../../Binding.js";
import { isInstance } from "../EC2/Instance.js";
import { isBindingHost } from "../Lambda/Function.js";
import { DescribeAutoScalingGroup } from "./DescribeAutoScalingGroup.js";
// Bespoke (not the shared scaffold): `describeAutoScalingGroups` takes the
// group name inside the `AutoScalingGroupNames` array and the client unwraps
// the single-element response.
export const DescribeAutoScalingGroupHttp = Layer.effect(DescribeAutoScalingGroup, Effect.gen(function* () {
    const describe = yield* autoscaling.describeAutoScalingGroups;
    return Effect.fn(function* (group) {
        const AutoScalingGroupName = yield* group.autoScalingGroupName;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host) || isInstance(host)) {
                yield* host.bind `Allow(${host}, AWS.AutoScaling.DescribeAutoScalingGroup(${group}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: ["autoscaling:DescribeAutoScalingGroups"],
                            Resource: ["*"],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`AWS.AutoScaling.DescribeAutoScalingGroup(${group.LogicalId})`)(function* () {
            const result = yield* describe({
                AutoScalingGroupNames: [yield* AutoScalingGroupName],
            });
            return result.AutoScalingGroups?.[0];
        });
    });
}));
//# sourceMappingURL=DescribeAutoScalingGroupHttp.js.map