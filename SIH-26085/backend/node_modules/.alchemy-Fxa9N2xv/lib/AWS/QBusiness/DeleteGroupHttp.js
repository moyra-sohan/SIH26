import * as qbusiness from "@distilled.cloud/aws/qbusiness";
import * as Layer from "effect/Layer";
import { makeQBusinessIndexHttpBinding } from "./BindingHttp.js";
import { DeleteGroup } from "./DeleteGroup.js";
export const DeleteGroupHttp = Layer.effect(DeleteGroup, makeQBusinessIndexHttpBinding({
    tag: "AWS.QBusiness.DeleteGroup",
    operation: qbusiness.deleteGroup,
    actions: ["qbusiness:DeleteGroup"],
    subResources: ["data-source/*"],
}));
//# sourceMappingURL=DeleteGroupHttp.js.map