import * as efs from "@distilled.cloud/aws/efs";
import * as Layer from "effect/Layer";
import { makeEfsFileSystemHttpBinding } from "./BindingHttp.js";
import { CreateAccessPoint } from "./CreateAccessPoint.js";
export const CreateAccessPointHttp = Layer.effect(CreateAccessPoint, makeEfsFileSystemHttpBinding({
    tag: "AWS.EFS.CreateAccessPoint",
    operation: efs.createAccessPoint,
    actions: ["elasticfilesystem:CreateAccessPoint"],
    // Tag-on-create authorizes elasticfilesystem:TagResource against the
    // ARN of the access point being created, which is unknowable at deploy
    // time — grant it on `*`.
    wildcardActions: ["elasticfilesystem:TagResource"],
}));
//# sourceMappingURL=CreateAccessPointHttp.js.map