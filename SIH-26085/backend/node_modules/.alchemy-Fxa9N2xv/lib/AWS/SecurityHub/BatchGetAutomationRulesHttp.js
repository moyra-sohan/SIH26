import * as securityhub from "@distilled.cloud/aws/securityhub";
import * as Layer from "effect/Layer";
import { makeSecurityHubHttpBinding } from "./BindingHttp.js";
import { BatchGetAutomationRules } from "./BatchGetAutomationRules.js";
export const BatchGetAutomationRulesHttp = Layer.effect(BatchGetAutomationRules, makeSecurityHubHttpBinding({
    tag: "AWS.SecurityHub.BatchGetAutomationRules",
    operation: securityhub.batchGetAutomationRules,
    actions: ["securityhub:BatchGetAutomationRules"],
}));
//# sourceMappingURL=BatchGetAutomationRulesHttp.js.map