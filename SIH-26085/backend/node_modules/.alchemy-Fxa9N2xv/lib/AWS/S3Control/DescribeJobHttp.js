import * as s3control from "@distilled.cloud/aws/s3-control";
import * as Layer from "effect/Layer";
import { makeS3ControlAccountHttpBinding } from "./BindingHttp.js";
import { DescribeJob } from "./DescribeJob.js";
export const DescribeJobHttp = Layer.effect(DescribeJob, makeS3ControlAccountHttpBinding({
    tag: "AWS.S3Control.DescribeJob",
    operation: s3control.describeJob,
    actions: ["s3:DescribeJob"],
}));
//# sourceMappingURL=DescribeJobHttp.js.map