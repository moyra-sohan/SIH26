import * as identitystore from "@distilled.cloud/aws/identitystore";
import * as Layer from "effect/Layer";
import { makeIdentityStoreHttpBinding } from "./BindingHttp.js";
import { CreateGroupMembership } from "./CreateGroupMembership.js";
export const CreateGroupMembershipHttp = Layer.effect(CreateGroupMembership, makeIdentityStoreHttpBinding({
    tag: "AWS.IdentityCenter.CreateGroupMembership",
    operation: identitystore.createGroupMembership,
    actions: ["identitystore:CreateGroupMembership"],
}));
//# sourceMappingURL=CreateGroupMembershipHttp.js.map