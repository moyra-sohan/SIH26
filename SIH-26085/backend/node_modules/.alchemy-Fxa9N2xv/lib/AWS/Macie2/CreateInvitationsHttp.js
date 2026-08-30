import * as macie2 from "@distilled.cloud/aws/macie2";
import * as Layer from "effect/Layer";
import { makeMacie2HttpBinding } from "./BindingHttp.js";
import { CreateInvitations } from "./CreateInvitations.js";
export const CreateInvitationsHttp = Layer.effect(CreateInvitations, makeMacie2HttpBinding({
    tag: "AWS.Macie2.CreateInvitations",
    operation: macie2.createInvitations,
    actions: ["macie2:CreateInvitations"],
}));
//# sourceMappingURL=CreateInvitationsHttp.js.map