import * as comprehend from "@distilled.cloud/aws/comprehend";
import * as Layer from "effect/Layer";
import { makeComprehendHttpBinding } from "./BindingHttp.js";
import { DescribeDocumentClassificationJob } from "./DescribeDocumentClassificationJob.js";
export const DescribeDocumentClassificationJobHttp = Layer.effect(DescribeDocumentClassificationJob, makeComprehendHttpBinding({
    tag: "AWS.Comprehend.DescribeDocumentClassificationJob",
    operation: comprehend.describeDocumentClassificationJob,
    actions: ["comprehend:DescribeDocumentClassificationJob"],
}));
//# sourceMappingURL=DescribeDocumentClassificationJobHttp.js.map