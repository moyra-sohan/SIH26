import * as guardduty from "@distilled.cloud/aws/guardduty";
import * as Layer from "effect/Layer";
import { makeGuardDutyAccountHttpBinding } from "./BindingHttp.js";
import { DeleteInvitations } from "./DeleteInvitations.js";
export const DeleteInvitationsHttp = Layer.effect(DeleteInvitations, makeGuardDutyAccountHttpBinding({
    tag: "AWS.GuardDuty.DeleteInvitations",
    operation: guardduty.deleteInvitations,
    actions: ["guardduty:DeleteInvitations"],
}));
//# sourceMappingURL=DeleteInvitationsHttp.js.map