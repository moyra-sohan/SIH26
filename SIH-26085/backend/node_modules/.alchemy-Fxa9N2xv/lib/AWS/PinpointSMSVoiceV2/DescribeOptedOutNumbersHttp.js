import * as smsvoice from "@distilled.cloud/aws/pinpoint-sms-voice-v2";
import * as Layer from "effect/Layer";
import { makeSmsVoiceOptOutListHttpBinding } from "./BindingHttp.js";
import { DescribeOptedOutNumbers } from "./DescribeOptedOutNumbers.js";
export const DescribeOptedOutNumbersHttp = Layer.effect(DescribeOptedOutNumbers, makeSmsVoiceOptOutListHttpBinding({
    tag: "AWS.PinpointSMSVoiceV2.DescribeOptedOutNumbers",
    operation: smsvoice.describeOptedOutNumbers,
    actions: ["sms-voice:DescribeOptedOutNumbers"],
}));
//# sourceMappingURL=DescribeOptedOutNumbersHttp.js.map