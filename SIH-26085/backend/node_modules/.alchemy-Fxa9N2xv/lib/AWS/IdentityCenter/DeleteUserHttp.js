import * as identitystore from "@distilled.cloud/aws/identitystore";
import * as Layer from "effect/Layer";
import { makeIdentityStoreHttpBinding } from "./BindingHttp.js";
import { DeleteUser } from "./DeleteUser.js";
export const DeleteUserHttp = Layer.effect(DeleteUser, makeIdentityStoreHttpBinding({
    tag: "AWS.IdentityCenter.DeleteUser",
    operation: identitystore.deleteUser,
    actions: ["identitystore:DeleteUser"],
}));
//# sourceMappingURL=DeleteUserHttp.js.map