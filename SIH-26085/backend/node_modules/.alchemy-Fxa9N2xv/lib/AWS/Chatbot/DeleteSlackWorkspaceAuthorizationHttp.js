import * as chatbot from "@distilled.cloud/aws/chatbot";
import * as Layer from "effect/Layer";
import { makeChatbotAccountHttpBinding } from "./BindingHttp.js";
import { DeleteSlackWorkspaceAuthorization } from "./DeleteSlackWorkspaceAuthorization.js";
export const DeleteSlackWorkspaceAuthorizationHttp = Layer.effect(DeleteSlackWorkspaceAuthorization, makeChatbotAccountHttpBinding({
    tag: "AWS.Chatbot.DeleteSlackWorkspaceAuthorization",
    operation: chatbot.deleteSlackWorkspaceAuthorization,
    actions: ["chatbot:DeleteSlackWorkspaceAuthorization"],
}));
//# sourceMappingURL=DeleteSlackWorkspaceAuthorizationHttp.js.map