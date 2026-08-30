import * as sqs from "@distilled.cloud/aws/sqs";
import * as Layer from "effect/Layer";
import { makeQueueUrlHttpBinding } from "./BindingHttp.js";
import { DeleteMessage } from "./DeleteMessage.js";
export const DeleteMessageHttp = Layer.effect(DeleteMessage, makeQueueUrlHttpBinding({
    tag: "AWS.SQS.DeleteMessage",
    operation: sqs.deleteMessage,
    actions: ["sqs:DeleteMessage"],
}));
//# sourceMappingURL=DeleteMessageHttp.js.map