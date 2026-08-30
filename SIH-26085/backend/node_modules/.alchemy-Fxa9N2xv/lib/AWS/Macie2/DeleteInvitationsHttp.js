import * as macie2 from "@distilled.cloud/aws/macie2";
import * as Layer from "effect/Layer";
import { makeMacie2HttpBinding } from "./BindingHttp.js";
import { DeleteInvitations } from "./DeleteInvitations.js";
export const DeleteInvitationsHttp = Layer.effect(DeleteInvitations, makeMacie2HttpBinding({
    tag: "AWS.Macie2.DeleteInvitations",
    operation: macie2.deleteInvitations,
    actions: ["macie2:DeleteInvitations"],
}));
//# sourceMappingURL=DeleteInvitationsHttp.js.map