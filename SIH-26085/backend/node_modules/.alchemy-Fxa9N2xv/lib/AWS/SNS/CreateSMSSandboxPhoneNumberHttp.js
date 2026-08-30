import * as sns from "@distilled.cloud/aws/sns";
import * as Layer from "effect/Layer";
import { makeSnsAccountHttpBinding } from "./BindingHttp.js";
import { CreateSMSSandboxPhoneNumber } from "./CreateSMSSandboxPhoneNumber.js";
export const CreateSMSSandboxPhoneNumberHttp = Layer.effect(CreateSMSSandboxPhoneNumber, makeSnsAccountHttpBinding({
    tag: "AWS.SNS.CreateSMSSandboxPhoneNumber",
    operation: sns.createSMSSandboxPhoneNumber,
    // Registering a sandbox number creates a verified destination number
    // and sends the OTP text via End User Messaging (probe-verified).
    actions: [
        "sns:CreateSMSSandboxPhoneNumber",
        "sms-voice:CreateVerifiedDestinationNumber",
        "sms-voice:SendDestinationNumberVerificationCode",
        "sms-voice:SendTextMessage",
    ],
}));
//# sourceMappingURL=CreateSMSSandboxPhoneNumberHttp.js.map