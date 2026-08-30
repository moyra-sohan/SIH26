import * as smsvoice from "@distilled.cloud/aws/pinpoint-sms-voice-v2";
import * as Layer from "effect/Layer";
import { makeSmsVoiceOptOutListHttpBinding } from "./BindingHttp.js";
import { DeleteOptedOutNumber } from "./DeleteOptedOutNumber.js";
export const DeleteOptedOutNumberHttp = Layer.effect(DeleteOptedOutNumber, makeSmsVoiceOptOutListHttpBinding({
    tag: "AWS.PinpointSMSVoiceV2.DeleteOptedOutNumber",
    operation: smsvoice.deleteOptedOutNumber,
    actions: ["sms-voice:DeleteOptedOutNumber"],
}));
//# sourceMappingURL=DeleteOptedOutNumberHttp.js.map