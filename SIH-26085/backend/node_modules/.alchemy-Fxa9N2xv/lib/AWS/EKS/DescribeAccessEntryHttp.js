import * as eks from "@distilled.cloud/aws/eks";
import * as Layer from "effect/Layer";
import { makeEKSClusterHttpBinding } from "./BindingHttp.js";
import { DescribeAccessEntry } from "./DescribeAccessEntry.js";
export const DescribeAccessEntryHttp = Layer.effect(DescribeAccessEntry, makeEKSClusterHttpBinding({
    tag: "AWS.EKS.DescribeAccessEntry",
    operation: eks.describeAccessEntry,
    actions: ["eks:DescribeAccessEntry"],
    key: "clusterName",
    scope: "subresources",
}));
//# sourceMappingURL=DescribeAccessEntryHttp.js.map