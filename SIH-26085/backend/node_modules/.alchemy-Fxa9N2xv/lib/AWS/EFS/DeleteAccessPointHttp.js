import * as efs from "@distilled.cloud/aws/efs";
import * as Layer from "effect/Layer";
import { makeEfsAccountHttpBinding } from "./BindingHttp.js";
import { DeleteAccessPoint } from "./DeleteAccessPoint.js";
export const DeleteAccessPointHttp = Layer.effect(DeleteAccessPoint, makeEfsAccountHttpBinding({
    tag: "AWS.EFS.DeleteAccessPoint",
    operation: efs.deleteAccessPoint,
    actions: ["elasticfilesystem:DeleteAccessPoint"],
}));
//# sourceMappingURL=DeleteAccessPointHttp.js.map