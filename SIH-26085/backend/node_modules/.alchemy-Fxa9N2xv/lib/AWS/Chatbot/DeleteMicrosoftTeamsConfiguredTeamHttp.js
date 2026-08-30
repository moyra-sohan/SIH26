import * as chatbot from "@distilled.cloud/aws/chatbot";
import * as Layer from "effect/Layer";
import { makeChatbotAccountHttpBinding } from "./BindingHttp.js";
import { DeleteMicrosoftTeamsConfiguredTeam } from "./DeleteMicrosoftTeamsConfiguredTeam.js";
export const DeleteMicrosoftTeamsConfiguredTeamHttp = Layer.effect(DeleteMicrosoftTeamsConfiguredTeam, makeChatbotAccountHttpBinding({
    tag: "AWS.Chatbot.DeleteMicrosoftTeamsConfiguredTeam",
    operation: chatbot.deleteMicrosoftTeamsConfiguredTeam,
    actions: ["chatbot:DeleteMicrosoftTeamsConfiguredTeam"],
}));
//# sourceMappingURL=DeleteMicrosoftTeamsConfiguredTeamHttp.js.map