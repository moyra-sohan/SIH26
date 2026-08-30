import * as rds from "@distilled.cloud/aws/rds";
import * as Layer from "effect/Layer";
import { makeRdsAccountHttpBinding } from "./BindingHttp.js";
import { DescribeDBClusters } from "./DescribeDBClusters.js";
export const DescribeDBClustersHttp = Layer.effect(DescribeDBClusters, makeRdsAccountHttpBinding({
    tag: "AWS.RDS.DescribeDBClusters",
    operation: rds.describeDBClusters,
    actions: ["rds:DescribeDBClusters"],
}));
//# sourceMappingURL=DescribeDBClustersHttp.js.map