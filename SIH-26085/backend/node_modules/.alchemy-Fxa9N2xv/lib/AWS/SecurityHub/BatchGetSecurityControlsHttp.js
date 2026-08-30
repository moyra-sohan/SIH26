import * as securityhub from "@distilled.cloud/aws/securityhub";
import * as Layer from "effect/Layer";
import { makeSecurityHubHttpBinding } from "./BindingHttp.js";
import { BatchGetSecurityControls } from "./BatchGetSecurityControls.js";
export const BatchGetSecurityControlsHttp = Layer.effect(BatchGetSecurityControls, makeSecurityHubHttpBinding({
    tag: "AWS.SecurityHub.BatchGetSecurityControls",
    operation: securityhub.batchGetSecurityControls,
    actions: ["securityhub:BatchGetSecurityControls"],
}));
//# sourceMappingURL=BatchGetSecurityControlsHttp.js.map