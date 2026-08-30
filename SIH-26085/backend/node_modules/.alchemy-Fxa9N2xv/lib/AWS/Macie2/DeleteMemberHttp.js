import * as macie2 from "@distilled.cloud/aws/macie2";
import * as Layer from "effect/Layer";
import { makeMacie2HttpBinding } from "./BindingHttp.js";
import { DeleteMember } from "./DeleteMember.js";
export const DeleteMemberHttp = Layer.effect(DeleteMember, makeMacie2HttpBinding({
    tag: "AWS.Macie2.DeleteMember",
    operation: macie2.deleteMember,
    actions: ["macie2:DeleteMember"],
}));
//# sourceMappingURL=DeleteMemberHttp.js.map