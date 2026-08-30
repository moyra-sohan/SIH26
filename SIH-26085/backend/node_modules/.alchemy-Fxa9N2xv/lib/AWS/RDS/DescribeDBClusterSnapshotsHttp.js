import * as rds from "@distilled.cloud/aws/rds";
import * as Layer from "effect/Layer";
import { makeRdsAccountHttpBinding } from "./BindingHttp.js";
import { DescribeDBClusterSnapshots } from "./DescribeDBClusterSnapshots.js";
export const DescribeDBClusterSnapshotsHttp = Layer.effect(DescribeDBClusterSnapshots, makeRdsAccountHttpBinding({
    tag: "AWS.RDS.DescribeDBClusterSnapshots",
    operation: rds.describeDBClusterSnapshots,
    actions: ["rds:DescribeDBClusterSnapshots"],
}));
//# sourceMappingURL=DescribeDBClusterSnapshotsHttp.js.map