import * as eks from "@distilled.cloud/aws/eks";
import * as Layer from "effect/Layer";
import { makeEKSClusterHttpBinding } from "./BindingHttp.js";
import { DescribeInsightsRefresh } from "./DescribeInsightsRefresh.js";
export const DescribeInsightsRefreshHttp = Layer.effect(DescribeInsightsRefresh, makeEKSClusterHttpBinding({
    tag: "AWS.EKS.DescribeInsightsRefresh",
    operation: eks.describeInsightsRefresh,
    actions: ["eks:DescribeInsightsRefresh"],
    key: "clusterName",
    scope: "cluster",
}));
//# sourceMappingURL=DescribeInsightsRefreshHttp.js.map