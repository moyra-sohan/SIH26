import * as qbusiness from "@distilled.cloud/aws/qbusiness";
import * as Layer from "effect/Layer";
import { makeQBusinessApplicationHttpBinding } from "./BindingHttp.js";
import { DeleteUser } from "./DeleteUser.js";
export const DeleteUserHttp = Layer.effect(DeleteUser, makeQBusinessApplicationHttpBinding({
    tag: "AWS.QBusiness.DeleteUser",
    operation: qbusiness.deleteUser,
    actions: ["qbusiness:DeleteUser"],
}));
//# sourceMappingURL=DeleteUserHttp.js.map