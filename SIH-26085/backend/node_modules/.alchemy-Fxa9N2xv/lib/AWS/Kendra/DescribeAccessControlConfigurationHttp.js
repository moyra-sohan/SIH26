import * as kendra from "@distilled.cloud/aws/kendra";
import * as Layer from "effect/Layer";
import { makeKendraIndexHttpBinding } from "./BindingHttp.js";
import { DescribeAccessControlConfiguration } from "./DescribeAccessControlConfiguration.js";
export const DescribeAccessControlConfigurationHttp = Layer.effect(DescribeAccessControlConfiguration, makeKendraIndexHttpBinding({
    tag: "AWS.Kendra.DescribeAccessControlConfiguration",
    operation: kendra.describeAccessControlConfiguration,
    actions: ["kendra:DescribeAccessControlConfiguration"],
    subResources: ["access-control-configuration/*"],
}));
//# sourceMappingURL=DescribeAccessControlConfigurationHttp.js.map