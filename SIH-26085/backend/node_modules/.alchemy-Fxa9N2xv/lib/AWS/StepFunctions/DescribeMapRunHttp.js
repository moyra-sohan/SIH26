import * as sfn from "@distilled.cloud/aws/sfn";
import * as Layer from "effect/Layer";
import { makeExecutionScopedHttpBinding } from "./BindingHttp.js";
import { DescribeMapRun } from "./DescribeMapRun.js";
export const DescribeMapRunHttp = Layer.effect(DescribeMapRun, makeExecutionScopedHttpBinding({
    tag: "AWS.StepFunctions.DescribeMapRun",
    operation: sfn.describeMapRun,
    actions: ["states:DescribeMapRun"],
    scope: "mapRun",
}));
//# sourceMappingURL=DescribeMapRunHttp.js.map