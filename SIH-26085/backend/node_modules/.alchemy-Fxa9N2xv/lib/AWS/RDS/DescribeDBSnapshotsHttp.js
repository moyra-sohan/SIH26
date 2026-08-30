import * as rds from "@distilled.cloud/aws/rds";
import * as Layer from "effect/Layer";
import { makeRdsAccountHttpBinding } from "./BindingHttp.js";
import { DescribeDBSnapshots } from "./DescribeDBSnapshots.js";
export const DescribeDBSnapshotsHttp = Layer.effect(DescribeDBSnapshots, makeRdsAccountHttpBinding({
    tag: "AWS.RDS.DescribeDBSnapshots",
    operation: rds.describeDBSnapshots,
    actions: ["rds:DescribeDBSnapshots"],
}));
//# sourceMappingURL=DescribeDBSnapshotsHttp.js.map