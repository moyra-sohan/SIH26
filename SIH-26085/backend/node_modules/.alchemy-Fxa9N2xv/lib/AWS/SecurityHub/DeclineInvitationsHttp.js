import * as securityhub from "@distilled.cloud/aws/securityhub";
import * as Layer from "effect/Layer";
import { makeSecurityHubHttpBinding } from "./BindingHttp.js";
import { DeclineInvitations } from "./DeclineInvitations.js";
export const DeclineInvitationsHttp = Layer.effect(DeclineInvitations, makeSecurityHubHttpBinding({
    tag: "AWS.SecurityHub.DeclineInvitations",
    operation: securityhub.declineInvitations,
    actions: ["securityhub:DeclineInvitations"],
}));
//# sourceMappingURL=DeclineInvitationsHttp.js.map