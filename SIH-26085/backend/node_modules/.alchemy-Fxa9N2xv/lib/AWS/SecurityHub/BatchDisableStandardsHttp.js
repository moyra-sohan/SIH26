import * as securityhub from "@distilled.cloud/aws/securityhub";
import * as Layer from "effect/Layer";
import { makeSecurityHubHttpBinding } from "./BindingHttp.js";
import { BatchDisableStandards } from "./BatchDisableStandards.js";
export const BatchDisableStandardsHttp = Layer.effect(BatchDisableStandards, makeSecurityHubHttpBinding({
    tag: "AWS.SecurityHub.BatchDisableStandards",
    operation: securityhub.batchDisableStandards,
    actions: ["securityhub:BatchDisableStandards"],
}));
//# sourceMappingURL=BatchDisableStandardsHttp.js.map