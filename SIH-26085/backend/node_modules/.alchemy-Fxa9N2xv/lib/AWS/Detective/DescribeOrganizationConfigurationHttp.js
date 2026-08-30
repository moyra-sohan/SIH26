import * as detective from "@distilled.cloud/aws/detective";
import * as Layer from "effect/Layer";
import { makeDetectiveGraphHttpBinding } from "./BindingHttp.js";
import { DescribeOrganizationConfiguration } from "./DescribeOrganizationConfiguration.js";
export const DescribeOrganizationConfigurationHttp = Layer.effect(DescribeOrganizationConfiguration, makeDetectiveGraphHttpBinding({
    tag: "AWS.Detective.DescribeOrganizationConfiguration",
    operation: detective.describeOrganizationConfiguration,
    actions: ["detective:DescribeOrganizationConfiguration"],
}));
//# sourceMappingURL=DescribeOrganizationConfigurationHttp.js.map