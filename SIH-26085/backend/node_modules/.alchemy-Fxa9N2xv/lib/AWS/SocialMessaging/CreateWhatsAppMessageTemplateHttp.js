import * as socialmessaging from "@distilled.cloud/aws/socialmessaging";
import * as Layer from "effect/Layer";
import { makeWabaScopedHttpBinding } from "./BindingHttp.js";
import { CreateWhatsAppMessageTemplate } from "./CreateWhatsAppMessageTemplate.js";
export const CreateWhatsAppMessageTemplateHttp = Layer.effect(CreateWhatsAppMessageTemplate, makeWabaScopedHttpBinding({
    tag: "AWS.SocialMessaging.CreateWhatsAppMessageTemplate",
    operation: socialmessaging.createWhatsAppMessageTemplate,
    actions: ["social-messaging:CreateWhatsAppMessageTemplate"],
}));
//# sourceMappingURL=CreateWhatsAppMessageTemplateHttp.js.map