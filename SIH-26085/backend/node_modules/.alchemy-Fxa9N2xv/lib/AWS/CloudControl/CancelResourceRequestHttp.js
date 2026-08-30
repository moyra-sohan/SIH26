import * as cloudcontrol from "@distilled.cloud/aws/cloudcontrol";
import * as Layer from "effect/Layer";
import { makeCloudControlHttpBinding } from "./BindingHttp.js";
import { CancelResourceRequest } from "./CancelResourceRequest.js";
export const CancelResourceRequestHttp = Layer.effect(CancelResourceRequest, makeCloudControlHttpBinding({
    tag: "AWS.CloudControl.CancelResourceRequest",
    operation: cloudcontrol.cancelResourceRequest,
    actions: ["cloudformation:CancelResourceRequest"],
}));
//# sourceMappingURL=CancelResourceRequestHttp.js.map