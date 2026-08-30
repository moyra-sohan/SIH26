import * as efs from "@distilled.cloud/aws/efs";
import * as Layer from "effect/Layer";
import { makeEfsFileSystemHttpBinding } from "./BindingHttp.js";
import { DescribeAccessPoints } from "./DescribeAccessPoints.js";
export const DescribeAccessPointsHttp = Layer.effect(DescribeAccessPoints, makeEfsFileSystemHttpBinding({
    tag: "AWS.EFS.DescribeAccessPoints",
    operation: efs.describeAccessPoints,
    actions: ["elasticfilesystem:DescribeAccessPoints"],
}));
//# sourceMappingURL=DescribeAccessPointsHttp.js.map