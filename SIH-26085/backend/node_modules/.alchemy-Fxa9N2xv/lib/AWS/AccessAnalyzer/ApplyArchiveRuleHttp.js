import * as aa from "@distilled.cloud/aws/accessanalyzer";
import * as Layer from "effect/Layer";
import { makeAnalyzerScopedHttpBinding } from "./BindingHttp.js";
import { ApplyArchiveRule } from "./ApplyArchiveRule.js";
export const ApplyArchiveRuleHttp = Layer.effect(ApplyArchiveRule, makeAnalyzerScopedHttpBinding({
    tag: "AWS.AccessAnalyzer.ApplyArchiveRule",
    operation: aa.applyArchiveRule,
    actions: ["access-analyzer:ApplyArchiveRule"],
}));
//# sourceMappingURL=ApplyArchiveRuleHttp.js.map