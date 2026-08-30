import * as securityhub from "@distilled.cloud/aws/securityhub";
import * as Layer from "effect/Layer";
import { makeSecurityHubHttpBinding } from "./BindingHttp.js";
import { DeleteInvitations } from "./DeleteInvitations.js";
export const DeleteInvitationsHttp = Layer.effect(DeleteInvitations, makeSecurityHubHttpBinding({
    tag: "AWS.SecurityHub.DeleteInvitations",
    operation: securityhub.deleteInvitations,
    actions: ["securityhub:DeleteInvitations"],
}));
//# sourceMappingURL=DeleteInvitationsHttp.js.map