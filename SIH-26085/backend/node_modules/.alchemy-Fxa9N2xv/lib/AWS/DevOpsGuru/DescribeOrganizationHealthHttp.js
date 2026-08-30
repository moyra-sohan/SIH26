import * as devopsguru from "@distilled.cloud/aws/devops-guru";
import * as Layer from "effect/Layer";
import { makeDevOpsGuruAccountHttpBinding } from "./BindingHttp.js";
import { DescribeOrganizationHealth } from "./DescribeOrganizationHealth.js";
export const DescribeOrganizationHealthHttp = Layer.effect(DescribeOrganizationHealth, makeDevOpsGuruAccountHttpBinding({
    tag: "AWS.DevOpsGuru.DescribeOrganizationHealth",
    operation: devopsguru.describeOrganizationHealth,
    actions: ["devops-guru:DescribeOrganizationHealth"],
}));
//# sourceMappingURL=DescribeOrganizationHealthHttp.js.map