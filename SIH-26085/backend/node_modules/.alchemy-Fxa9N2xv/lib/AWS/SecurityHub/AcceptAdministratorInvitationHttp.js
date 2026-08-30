import * as securityhub from "@distilled.cloud/aws/securityhub";
import * as Layer from "effect/Layer";
import { makeSecurityHubHttpBinding } from "./BindingHttp.js";
import { AcceptAdministratorInvitation } from "./AcceptAdministratorInvitation.js";
export const AcceptAdministratorInvitationHttp = Layer.effect(AcceptAdministratorInvitation, makeSecurityHubHttpBinding({
    tag: "AWS.SecurityHub.AcceptAdministratorInvitation",
    operation: securityhub.acceptAdministratorInvitation,
    actions: ["securityhub:AcceptAdministratorInvitation"],
}));
//# sourceMappingURL=AcceptAdministratorInvitationHttp.js.map