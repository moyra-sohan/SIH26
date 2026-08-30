import * as qbusiness from "@distilled.cloud/aws/qbusiness";
import * as Layer from "effect/Layer";
import { makeQBusinessApplicationHttpBinding } from "./BindingHttp.js";
import { AssociatePermission } from "./AssociatePermission.js";
export const AssociatePermissionHttp = Layer.effect(AssociatePermission, makeQBusinessApplicationHttpBinding({
    tag: "AWS.QBusiness.AssociatePermission",
    operation: qbusiness.associatePermission,
    actions: ["qbusiness:AssociatePermission"],
}));
//# sourceMappingURL=AssociatePermissionHttp.js.map