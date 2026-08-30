import * as docdb from "@distilled.cloud/aws/docdb";
import * as Layer from "effect/Layer";
import { makeDocDBAccountHttpBinding } from "./BindingHttp.js";
import { DescribeDBClusterSnapshots } from "./DescribeDBClusterSnapshots.js";
export const DescribeDBClusterSnapshotsHttp = Layer.effect(DescribeDBClusterSnapshots, makeDocDBAccountHttpBinding({
    tag: "AWS.DocDB.DescribeDBClusterSnapshots",
    operation: docdb.describeDBClusterSnapshots,
    actions: ["rds:DescribeDBClusterSnapshots"],
}));
//# sourceMappingURL=DescribeDBClusterSnapshotsHttp.js.map