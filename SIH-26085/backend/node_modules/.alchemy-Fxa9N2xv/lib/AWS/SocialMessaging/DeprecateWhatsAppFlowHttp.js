import * as socialmessaging from "@distilled.cloud/aws/socialmessaging";
import * as Layer from "effect/Layer";
import { makeWabaScopedHttpBinding } from "./BindingHttp.js";
import { DeprecateWhatsAppFlow } from "./DeprecateWhatsAppFlow.js";
export const DeprecateWhatsAppFlowHttp = Layer.effect(DeprecateWhatsAppFlow, makeWabaScopedHttpBinding({
    tag: "AWS.SocialMessaging.DeprecateWhatsAppFlow",
    operation: socialmessaging.deprecateWhatsAppFlow,
    actions: ["social-messaging:DeprecateWhatsAppFlow"],
}));
//# sourceMappingURL=DeprecateWhatsAppFlowHttp.js.map