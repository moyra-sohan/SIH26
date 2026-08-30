import * as rds from "@distilled.cloud/aws/rds";
import * as Layer from "effect/Layer";
import { makeRdsAccountHttpBinding } from "./BindingHttp.js";
import { DescribeDBClusterEndpoints } from "./DescribeDBClusterEndpoints.js";
export const DescribeDBClusterEndpointsHttp = Layer.effect(DescribeDBClusterEndpoints, makeRdsAccountHttpBinding({
    tag: "AWS.RDS.DescribeDBClusterEndpoints",
    operation: rds.describeDBClusterEndpoints,
    actions: ["rds:DescribeDBClusterEndpoints"],
}));
//# sourceMappingURL=DescribeDBClusterEndpointsHttp.js.map