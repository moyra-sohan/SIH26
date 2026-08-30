import * as guardduty from "@distilled.cloud/aws/guardduty";
import * as Layer from "effect/Layer";
import { makeGuardDutyDetectorHttpBinding } from "./BindingHttp.js";
import { DescribeOrganizationConfiguration } from "./DescribeOrganizationConfiguration.js";
export const DescribeOrganizationConfigurationHttp = Layer.effect(DescribeOrganizationConfiguration, makeGuardDutyDetectorHttpBinding({
    tag: "AWS.GuardDuty.DescribeOrganizationConfiguration",
    operation: guardduty.describeOrganizationConfiguration,
    actions: ["guardduty:DescribeOrganizationConfiguration"],
}));
//# sourceMappingURL=DescribeOrganizationConfigurationHttp.js.map