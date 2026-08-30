import * as ec2 from "@distilled.cloud/aws/ec2";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Binding from "../../Binding.js";
import { isBindingHost } from "../Lambda/Function.js";
import { DescribeInstance } from "./DescribeInstance.js";
import { isInstance } from "./Instance.js";
// Bespoke (not the shared scaffold): `describeInstances` nests results under
// Reservations[].Instances[] and the client unwraps the single bound
// instance.
export const DescribeInstanceHttp = Layer.effect(DescribeInstance, Effect.gen(function* () {
    const describe = yield* ec2.describeInstances;
    return Effect.fn(function* (instance) {
        const instanceId = yield* instance.instanceId;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host) || isInstance(host)) {
                yield* host.bind `Allow(${host}, AWS.EC2.DescribeInstance(${instance}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: ["ec2:DescribeInstances"],
                            Resource: ["*"],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`AWS.EC2.DescribeInstance(${instance.LogicalId})`)(function* () {
            const result = yield* describe({
                InstanceIds: [yield* instanceId],
            });
            return result.Reservations?.[0]?.Instances?.[0];
        });
    });
}));
//# sourceMappingURL=DescribeInstanceHttp.js.map