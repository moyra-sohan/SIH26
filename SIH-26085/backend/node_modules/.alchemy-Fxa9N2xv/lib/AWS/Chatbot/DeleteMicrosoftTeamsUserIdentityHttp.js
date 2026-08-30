import * as chatbot from "@distilled.cloud/aws/chatbot";
import * as Layer from "effect/Layer";
import { makeChatbotAccountHttpBinding } from "./BindingHttp.js";
import { DeleteMicrosoftTeamsUserIdentity } from "./DeleteMicrosoftTeamsUserIdentity.js";
export const DeleteMicrosoftTeamsUserIdentityHttp = Layer.effect(DeleteMicrosoftTeamsUserIdentity, makeChatbotAccountHttpBinding({
    tag: "AWS.Chatbot.DeleteMicrosoftTeamsUserIdentity",
    operation: chatbot.deleteMicrosoftTeamsUserIdentity,
    actions: ["chatbot:DeleteMicrosoftTeamsUserIdentity"],
}));
//# sourceMappingURL=DeleteMicrosoftTeamsUserIdentityHttp.js.map