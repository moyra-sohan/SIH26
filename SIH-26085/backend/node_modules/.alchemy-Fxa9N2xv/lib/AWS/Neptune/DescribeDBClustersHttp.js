import * as neptune from "@distilled.cloud/aws/neptune";
import * as Layer from "effect/Layer";
import { makeNeptuneAccountHttpBinding } from "./BindingHttp.js";
import { DescribeDBClusters } from "./DescribeDBClusters.js";
export const DescribeDBClustersHttp = Layer.effect(DescribeDBClusters, makeNeptuneAccountHttpBinding({
    tag: "AWS.Neptune.DescribeDBClusters",
    operation: neptune.describeDBClusters,
    actions: ["rds:DescribeDBClusters"],
}));
//# sourceMappingURL=DescribeDBClustersHttp.js.map