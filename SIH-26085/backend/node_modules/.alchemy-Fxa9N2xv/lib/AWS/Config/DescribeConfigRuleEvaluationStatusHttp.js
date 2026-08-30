import * as config from "@distilled.cloud/aws/config-service";
import * as Layer from "effect/Layer";
import { makeConfigAccountHttpBinding } from "./BindingHttp.js";
import { DescribeConfigRuleEvaluationStatus } from "./DescribeConfigRuleEvaluationStatus.js";
export const DescribeConfigRuleEvaluationStatusHttp = Layer.effect(DescribeConfigRuleEvaluationStatus, makeConfigAccountHttpBinding({
    tag: "AWS.Config.DescribeConfigRuleEvaluationStatus",
    operation: config.describeConfigRuleEvaluationStatus,
    actions: ["config:DescribeConfigRuleEvaluationStatus"],
}));
//# sourceMappingURL=DescribeConfigRuleEvaluationStatusHttp.js.map