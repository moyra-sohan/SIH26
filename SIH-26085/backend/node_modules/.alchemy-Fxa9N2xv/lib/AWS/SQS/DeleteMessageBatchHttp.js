import * as sqs from "@distilled.cloud/aws/sqs";
import * as Layer from "effect/Layer";
import { makeQueueUrlHttpBinding } from "./BindingHttp.js";
import { DeleteMessageBatch } from "./DeleteMessageBatch.js";
export const DeleteMessageBatchHttp = Layer.effect(DeleteMessageBatch, makeQueueUrlHttpBinding({
    tag: "AWS.SQS.DeleteMessageBatch",
    operation: sqs.deleteMessageBatch,
    // Batch entries are authorized by the singular action.
    actions: ["sqs:DeleteMessage"],
}));
//# sourceMappingURL=DeleteMessageBatchHttp.js.map