import * as socialmessaging from "@distilled.cloud/aws/socialmessaging";
import * as Layer from "effect/Layer";
import { makeWabaPhonePlaneHttpBinding } from "./BindingHttp.js";
import { DeleteWhatsAppMessageMedia } from "./DeleteWhatsAppMessageMedia.js";
export const DeleteWhatsAppMessageMediaHttp = Layer.effect(DeleteWhatsAppMessageMedia, makeWabaPhonePlaneHttpBinding({
    tag: "AWS.SocialMessaging.DeleteWhatsAppMessageMedia",
    operation: socialmessaging.deleteWhatsAppMessageMedia,
    actions: ["social-messaging:DeleteWhatsAppMessageMedia"],
}));
//# sourceMappingURL=DeleteWhatsAppMessageMediaHttp.js.map