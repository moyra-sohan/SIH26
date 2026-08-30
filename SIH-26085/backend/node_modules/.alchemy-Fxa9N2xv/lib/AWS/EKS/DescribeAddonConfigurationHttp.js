import * as eks from "@distilled.cloud/aws/eks";
import * as Layer from "effect/Layer";
import { makeEKSAccountHttpBinding } from "./BindingHttp.js";
import { DescribeAddonConfiguration } from "./DescribeAddonConfiguration.js";
export const DescribeAddonConfigurationHttp = Layer.effect(DescribeAddonConfiguration, makeEKSAccountHttpBinding({
    tag: "AWS.EKS.DescribeAddonConfiguration",
    operation: eks.describeAddonConfiguration,
    actions: ["eks:DescribeAddonConfiguration"],
}));
//# sourceMappingURL=DescribeAddonConfigurationHttp.js.map