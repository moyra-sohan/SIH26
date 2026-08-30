import * as neptune from "@distilled.cloud/aws/neptune";
import * as Layer from "effect/Layer";
import { makeNeptuneAccountHttpBinding } from "./BindingHttp.js";
import { DescribeDBClusterEndpoints } from "./DescribeDBClusterEndpoints.js";
export const DescribeDBClusterEndpointsHttp = Layer.effect(DescribeDBClusterEndpoints, makeNeptuneAccountHttpBinding({
    tag: "AWS.Neptune.DescribeDBClusterEndpoints",
    operation: neptune.describeDBClusterEndpoints,
    actions: ["rds:DescribeDBClusterEndpoints"],
}));
//# sourceMappingURL=DescribeDBClusterEndpointsHttp.js.map