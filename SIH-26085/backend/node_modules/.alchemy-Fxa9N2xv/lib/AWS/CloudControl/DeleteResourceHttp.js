import * as cloudcontrol from "@distilled.cloud/aws/cloudcontrol";
import * as Layer from "effect/Layer";
import { makeCloudControlHttpBinding } from "./BindingHttp.js";
import { DeleteResource } from "./DeleteResource.js";
export const DeleteResourceHttp = Layer.effect(DeleteResource, makeCloudControlHttpBinding({
    tag: "AWS.CloudControl.DeleteResource",
    operation: cloudcontrol.deleteResource,
    actions: ["cloudformation:DeleteResource"],
}));
//# sourceMappingURL=DeleteResourceHttp.js.map