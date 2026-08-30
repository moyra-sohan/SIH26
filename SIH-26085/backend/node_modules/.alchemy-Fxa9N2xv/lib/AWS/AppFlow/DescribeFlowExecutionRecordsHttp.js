import * as appflow from "@distilled.cloud/aws/appflow";
import * as Layer from "effect/Layer";
import { makeAppFlowHttpBinding } from "./BindingHttp.js";
import { DescribeFlowExecutionRecords } from "./DescribeFlowExecutionRecords.js";
export const DescribeFlowExecutionRecordsHttp = Layer.effect(DescribeFlowExecutionRecords, makeAppFlowHttpBinding({
    action: "DescribeFlowExecutionRecords",
    operation: appflow.describeFlowExecutionRecords,
    identifier: (flow) => flow.flowName,
    requestKey: "flowName",
    resources: (flow) => [flow.flowArn],
}));
//# sourceMappingURL=DescribeFlowExecutionRecordsHttp.js.map