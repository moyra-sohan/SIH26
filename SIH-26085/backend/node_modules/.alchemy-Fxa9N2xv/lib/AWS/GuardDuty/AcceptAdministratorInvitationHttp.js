import * as guardduty from "@distilled.cloud/aws/guardduty";
import * as Layer from "effect/Layer";
import { makeGuardDutyDetectorHttpBinding } from "./BindingHttp.js";
import { AcceptAdministratorInvitation } from "./AcceptAdministratorInvitation.js";
export const AcceptAdministratorInvitationHttp = Layer.effect(AcceptAdministratorInvitation, makeGuardDutyDetectorHttpBinding({
    tag: "AWS.GuardDuty.AcceptAdministratorInvitation",
    operation: guardduty.acceptAdministratorInvitation,
    actions: ["guardduty:AcceptAdministratorInvitation"],
}));
//# sourceMappingURL=AcceptAdministratorInvitationHttp.js.map