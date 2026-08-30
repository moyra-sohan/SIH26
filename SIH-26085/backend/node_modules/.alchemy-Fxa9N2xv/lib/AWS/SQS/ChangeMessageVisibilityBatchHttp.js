import * as sqs from "@distilled.cloud/aws/sqs";
import * as Layer from "effect/Layer";
import { makeQueueUrlHttpBinding } from "./BindingHttp.js";
import { ChangeMessageVisibilityBatch } from "./ChangeMessageVisibilityBatch.js";
export const ChangeMessageVisibilityBatchHttp = Layer.effect(ChangeMessageVisibilityBatch, makeQueueUrlHttpBinding({
    tag: "AWS.SQS.ChangeMessageVisibilityBatch",
    operation: sqs.changeMessageVisibilityBatch,
    // Batch entries are authorized by the singular action.
    actions: ["sqs:ChangeMessageVisibility"],
}));
//# sourceMappingURL=ChangeMessageVisibilityBatchHttp.js.map