import * as eks from "@distilled.cloud/aws/eks";
import * as Layer from "effect/Layer";
import { makeEKSClusterHttpBinding } from "./BindingHttp.js";
import { DescribeNodegroup } from "./DescribeNodegroup.js";
export const DescribeNodegroupHttp = Layer.effect(DescribeNodegroup, makeEKSClusterHttpBinding({
    tag: "AWS.EKS.DescribeNodegroup",
    operation: eks.describeNodegroup,
    actions: ["eks:DescribeNodegroup"],
    key: "clusterName",
    scope: "subresources",
}));
//# sourceMappingURL=DescribeNodegroupHttp.js.map