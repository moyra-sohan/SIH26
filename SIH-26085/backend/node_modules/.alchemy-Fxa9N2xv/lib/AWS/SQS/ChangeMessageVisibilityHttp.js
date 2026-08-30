import * as sqs from "@distilled.cloud/aws/sqs";
import * as Layer from "effect/Layer";
import { makeQueueUrlHttpBinding } from "./BindingHttp.js";
import { ChangeMessageVisibility } from "./ChangeMessageVisibility.js";
export const ChangeMessageVisibilityHttp = Layer.effect(ChangeMessageVisibility, makeQueueUrlHttpBinding({
    tag: "AWS.SQS.ChangeMessageVisibility",
    operation: sqs.changeMessageVisibility,
    actions: ["sqs:ChangeMessageVisibility"],
}));
//# sourceMappingURL=ChangeMessageVisibilityHttp.js.map