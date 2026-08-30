import * as eks from "@distilled.cloud/aws/eks";
import * as Layer from "effect/Layer";
import { makeEKSClusterHttpBinding } from "./BindingHttp.js";
import { DescribeAddon } from "./DescribeAddon.js";
export const DescribeAddonHttp = Layer.effect(DescribeAddon, makeEKSClusterHttpBinding({
    tag: "AWS.EKS.DescribeAddon",
    operation: eks.describeAddon,
    actions: ["eks:DescribeAddon"],
    key: "clusterName",
    scope: "subresources",
}));
//# sourceMappingURL=DescribeAddonHttp.js.map