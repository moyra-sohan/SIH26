import * as identitystore from "@distilled.cloud/aws/identitystore";
import * as Layer from "effect/Layer";
import { makeIdentityStoreHttpBinding } from "./BindingHttp.js";
import { DeleteGroupMembership } from "./DeleteGroupMembership.js";
export const DeleteGroupMembershipHttp = Layer.effect(DeleteGroupMembership, makeIdentityStoreHttpBinding({
    tag: "AWS.IdentityCenter.DeleteGroupMembership",
    operation: identitystore.deleteGroupMembership,
    actions: ["identitystore:DeleteGroupMembership"],
}));
//# sourceMappingURL=DeleteGroupMembershipHttp.js.map