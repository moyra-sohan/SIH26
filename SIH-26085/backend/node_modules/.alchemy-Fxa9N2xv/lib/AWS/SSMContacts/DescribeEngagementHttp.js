import * as ssm from "@distilled.cloud/aws/ssm-contacts";
import * as Layer from "effect/Layer";
import { makeAccountHttpBinding } from "./BindingHttp.js";
import { DescribeEngagement } from "./DescribeEngagement.js";
export const DescribeEngagementHttp = Layer.effect(DescribeEngagement, makeAccountHttpBinding({
    tag: "AWS.SSMContacts.DescribeEngagement",
    operation: ssm.describeEngagement,
    actions: ["ssm-contacts:DescribeEngagement"],
}));
//# sourceMappingURL=DescribeEngagementHttp.js.map