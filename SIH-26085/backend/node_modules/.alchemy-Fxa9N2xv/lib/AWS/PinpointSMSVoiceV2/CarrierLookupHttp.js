import * as smsvoice from "@distilled.cloud/aws/pinpoint-sms-voice-v2";
import * as Layer from "effect/Layer";
import { makeSmsVoiceAccountHttpBinding } from "./BindingHttp.js";
import { CarrierLookup } from "./CarrierLookup.js";
export const CarrierLookupHttp = Layer.effect(CarrierLookup, makeSmsVoiceAccountHttpBinding({
    tag: "AWS.PinpointSMSVoiceV2.CarrierLookup",
    operation: smsvoice.carrierLookup,
    actions: ["sms-voice:CarrierLookup"],
}));
//# sourceMappingURL=CarrierLookupHttp.js.map