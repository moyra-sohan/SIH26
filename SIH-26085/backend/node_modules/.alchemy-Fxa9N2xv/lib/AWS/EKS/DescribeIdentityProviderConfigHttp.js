import * as eks from "@distilled.cloud/aws/eks";
import * as Layer from "effect/Layer";
import { makeEKSClusterHttpBinding } from "./BindingHttp.js";
import { DescribeIdentityProviderConfig } from "./DescribeIdentityProviderConfig.js";
export const DescribeIdentityProviderConfigHttp = Layer.effect(DescribeIdentityProviderConfig, makeEKSClusterHttpBinding({
    tag: "AWS.EKS.DescribeIdentityProviderConfig",
    operation: eks.describeIdentityProviderConfig,
    actions: ["eks:DescribeIdentityProviderConfig"],
    key: "clusterName",
    scope: "subresources",
}));
//# sourceMappingURL=DescribeIdentityProviderConfigHttp.js.map