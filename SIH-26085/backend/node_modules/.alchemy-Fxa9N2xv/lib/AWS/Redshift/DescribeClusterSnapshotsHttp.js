import * as redshift from "@distilled.cloud/aws/redshift";
import * as Layer from "effect/Layer";
import { makeRedshiftAccountHttpBinding } from "./BindingHttp.js";
import { DescribeClusterSnapshots } from "./DescribeClusterSnapshots.js";
export const DescribeClusterSnapshotsHttp = Layer.effect(DescribeClusterSnapshots, makeRedshiftAccountHttpBinding({
    tag: "AWS.Redshift.DescribeClusterSnapshots",
    operation: redshift.describeClusterSnapshots,
    actions: ["redshift:DescribeClusterSnapshots"],
}));
//# sourceMappingURL=DescribeClusterSnapshotsHttp.js.map