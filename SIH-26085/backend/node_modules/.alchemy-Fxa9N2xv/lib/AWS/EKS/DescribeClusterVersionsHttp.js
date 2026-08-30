import * as eks from "@distilled.cloud/aws/eks";
import * as Layer from "effect/Layer";
import { makeEKSAccountHttpBinding } from "./BindingHttp.js";
import { DescribeClusterVersions } from "./DescribeClusterVersions.js";
export const DescribeClusterVersionsHttp = Layer.effect(DescribeClusterVersions, makeEKSAccountHttpBinding({
    tag: "AWS.EKS.DescribeClusterVersions",
    operation: eks.describeClusterVersions,
    actions: ["eks:DescribeClusterVersions"],
}));
//# sourceMappingURL=DescribeClusterVersionsHttp.js.map