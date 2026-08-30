import * as socialmessaging from "@distilled.cloud/aws/socialmessaging";
import * as Layer from "effect/Layer";
import { makeWabaScopedHttpBinding } from "./BindingHttp.js";
import { CreateWhatsAppMessageTemplateMedia } from "./CreateWhatsAppMessageTemplateMedia.js";
export const CreateWhatsAppMessageTemplateMediaHttp = Layer.effect(CreateWhatsAppMessageTemplateMedia, makeWabaScopedHttpBinding({
    tag: "AWS.SocialMessaging.CreateWhatsAppMessageTemplateMedia",
    operation: socialmessaging.createWhatsAppMessageTemplateMedia,
    actions: ["social-messaging:CreateWhatsAppMessageTemplateMedia"],
}));
//# sourceMappingURL=CreateWhatsAppMessageTemplateMediaHttp.js.map