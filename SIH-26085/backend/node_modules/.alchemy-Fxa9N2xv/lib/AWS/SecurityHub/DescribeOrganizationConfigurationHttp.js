import * as securityhub from "@distilled.cloud/aws/securityhub";
import * as Layer from "effect/Layer";
import { makeSecurityHubHttpBinding } from "./BindingHttp.js";
import { DescribeOrganizationConfiguration } from "./DescribeOrganizationConfiguration.js";
export const DescribeOrganizationConfigurationHttp = Layer.effect(DescribeOrganizationConfiguration, makeSecurityHubHttpBinding({
    tag: "AWS.SecurityHub.DescribeOrganizationConfiguration",
    operation: securityhub.describeOrganizationConfiguration,
    actions: ["securityhub:DescribeOrganizationConfiguration"],
}));
//# sourceMappingURL=DescribeOrganizationConfigurationHttp.js.map