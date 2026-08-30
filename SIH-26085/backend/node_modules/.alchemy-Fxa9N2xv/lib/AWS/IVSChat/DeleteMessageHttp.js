import * as ivschat from "@distilled.cloud/aws/ivschat";
import * as Layer from "effect/Layer";
import { makeIvsChatRoomHttpBinding } from "./BindingHttp.js";
import { DeleteMessage } from "./DeleteMessage.js";
export const DeleteMessageHttp = Layer.effect(DeleteMessage, makeIvsChatRoomHttpBinding({
    tag: "AWS.IVSChat.DeleteMessage",
    operation: ivschat.deleteMessage,
    actions: ["ivschat:DeleteMessage"],
}));
//# sourceMappingURL=DeleteMessageHttp.js.map