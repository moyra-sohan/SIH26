import * as appflow from "@distilled.cloud/aws/appflow";
import * as Layer from "effect/Layer";
import { makeAppFlowHttpBinding } from "./BindingHttp.js";
import { CancelFlowExecutions } from "./CancelFlowExecutions.js";
export const CancelFlowExecutionsHttp = Layer.effect(CancelFlowExecutions, makeAppFlowHttpBinding({
    action: "CancelFlowExecutions",
    operation: appflow.cancelFlowExecutions,
    identifier: (flow) => flow.flowName,
    requestKey: "flowName",
    resources: (flow) => [flow.flowArn],
}));
//# sourceMappingURL=CancelFlowExecutionsHttp.js.map