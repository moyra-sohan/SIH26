import * as identitystore from "@distilled.cloud/aws/identitystore";
import * as Layer from "effect/Layer";
import { makeIdentityStoreHttpBinding } from "./BindingHttp.js";
import { CreateUser } from "./CreateUser.js";
export const CreateUserHttp = Layer.effect(CreateUser, makeIdentityStoreHttpBinding({
    tag: "AWS.IdentityCenter.CreateUser",
    operation: identitystore.createUser,
    actions: ["identitystore:CreateUser"],
}));
//# sourceMappingURL=CreateUserHttp.js.map