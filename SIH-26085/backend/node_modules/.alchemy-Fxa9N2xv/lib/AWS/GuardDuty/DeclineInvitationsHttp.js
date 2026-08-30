import * as guardduty from "@distilled.cloud/aws/guardduty";
import * as Layer from "effect/Layer";
import { makeGuardDutyAccountHttpBinding } from "./BindingHttp.js";
import { DeclineInvitations } from "./DeclineInvitations.js";
export const DeclineInvitationsHttp = Layer.effect(DeclineInvitations, makeGuardDutyAccountHttpBinding({
    tag: "AWS.GuardDuty.DeclineInvitations",
    operation: guardduty.declineInvitations,
    actions: ["guardduty:DeclineInvitations"],
}));
//# sourceMappingURL=DeclineInvitationsHttp.js.map