import * as config from "@distilled.cloud/aws/config-service";
import * as Layer from "effect/Layer";
import { makeConfigAccountHttpBinding } from "./BindingHttp.js";
import { DescribeComplianceByConfigRule } from "./DescribeComplianceByConfigRule.js";
export const DescribeComplianceByConfigRuleHttp = Layer.effect(DescribeComplianceByConfigRule, makeConfigAccountHttpBinding({
    tag: "AWS.Config.DescribeComplianceByConfigRule",
    operation: config.describeComplianceByConfigRule,
    actions: ["config:DescribeComplianceByConfigRule"],
}));
//# sourceMappingURL=DescribeComplianceByConfigRuleHttp.js.map