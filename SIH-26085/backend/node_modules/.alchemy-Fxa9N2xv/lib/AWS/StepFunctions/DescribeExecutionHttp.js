import * as sfn from "@distilled.cloud/aws/sfn";
import * as Layer from "effect/Layer";
import { makeExecutionScopedHttpBinding } from "./BindingHttp.js";
import { DescribeExecution } from "./DescribeExecution.js";
export const DescribeExecutionHttp = Layer.effect(DescribeExecution, makeExecutionScopedHttpBinding({
    tag: "AWS.StepFunctions.DescribeExecution",
    operation: sfn.describeExecution,
    actions: ["states:DescribeExecution"],
}));
//# sourceMappingURL=DescribeExecutionHttp.js.map