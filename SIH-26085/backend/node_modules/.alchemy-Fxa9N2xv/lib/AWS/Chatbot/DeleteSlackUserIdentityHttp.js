import * as chatbot from "@distilled.cloud/aws/chatbot";
import * as Layer from "effect/Layer";
import { makeChatbotAccountHttpBinding } from "./BindingHttp.js";
import { DeleteSlackUserIdentity } from "./DeleteSlackUserIdentity.js";
export const DeleteSlackUserIdentityHttp = Layer.effect(DeleteSlackUserIdentity, makeChatbotAccountHttpBinding({
    tag: "AWS.Chatbot.DeleteSlackUserIdentity",
    operation: chatbot.deleteSlackUserIdentity,
    actions: ["chatbot:DeleteSlackUserIdentity"],
}));
//# sourceMappingURL=DeleteSlackUserIdentityHttp.js.map