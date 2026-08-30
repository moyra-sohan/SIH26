import * as batch from "@distilled.cloud/aws/batch";
import * as Layer from "effect/Layer";
import { makeBatchJobHttpBinding } from "./BindingHttp.js";
import { DescribeJobs } from "./DescribeJobs.js";
export const DescribeJobsHttp = Layer.effect(DescribeJobs, 
// batch:DescribeJobs does not support resource-level IAM.
makeBatchJobHttpBinding({
    tag: "AWS.Batch.DescribeJobs",
    operation: batch.describeJobs,
    actions: ["batch:DescribeJobs"],
}));
//# sourceMappingURL=DescribeJobsHttp.js.map