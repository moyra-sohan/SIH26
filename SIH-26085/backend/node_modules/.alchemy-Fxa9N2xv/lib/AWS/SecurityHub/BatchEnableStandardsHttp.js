import * as securityhub from "@distilled.cloud/aws/securityhub";
import * as Layer from "effect/Layer";
import { makeSecurityHubHttpBinding } from "./BindingHttp.js";
import { BatchEnableStandards } from "./BatchEnableStandards.js";
export const BatchEnableStandardsHttp = Layer.effect(BatchEnableStandards, makeSecurityHubHttpBinding({
    tag: "AWS.SecurityHub.BatchEnableStandards",
    operation: securityhub.batchEnableStandards,
    actions: ["securityhub:BatchEnableStandards"],
}));
//# sourceMappingURL=BatchEnableStandardsHttp.js.map