import * as qbusiness from "@distilled.cloud/aws/qbusiness";
import * as Layer from "effect/Layer";
import { makeQBusinessApplicationHttpBinding } from "./BindingHttp.js";
import { CreateUser } from "./CreateUser.js";
export const CreateUserHttp = Layer.effect(CreateUser, makeQBusinessApplicationHttpBinding({
    tag: "AWS.QBusiness.CreateUser",
    operation: qbusiness.createUser,
    actions: ["qbusiness:CreateUser"],
}));
//# sourceMappingURL=CreateUserHttp.js.map