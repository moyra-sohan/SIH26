import * as socialmessaging from "@distilled.cloud/aws/socialmessaging";
import * as Layer from "effect/Layer";
import { makeWabaScopedHttpBinding } from "./BindingHttp.js";
import { DeleteWhatsAppMessageTemplate } from "./DeleteWhatsAppMessageTemplate.js";
export const DeleteWhatsAppMessageTemplateHttp = Layer.effect(DeleteWhatsAppMessageTemplate, makeWabaScopedHttpBinding({
    tag: "AWS.SocialMessaging.DeleteWhatsAppMessageTemplate",
    operation: socialmessaging.deleteWhatsAppMessageTemplate,
    actions: ["social-messaging:DeleteWhatsAppMessageTemplate"],
}));
//# sourceMappingURL=DeleteWhatsAppMessageTemplateHttp.js.map