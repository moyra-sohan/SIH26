import * as socialmessaging from "@distilled.cloud/aws/socialmessaging";
import * as Layer from "effect/Layer";
import { makeWabaScopedHttpBinding } from "./BindingHttp.js";
import { CreateWhatsAppFlow } from "./CreateWhatsAppFlow.js";
export const CreateWhatsAppFlowHttp = Layer.effect(CreateWhatsAppFlow, makeWabaScopedHttpBinding({
    tag: "AWS.SocialMessaging.CreateWhatsAppFlow",
    operation: socialmessaging.createWhatsAppFlow,
    actions: ["social-messaging:CreateWhatsAppFlow"],
}));
//# sourceMappingURL=CreateWhatsAppFlowHttp.js.map