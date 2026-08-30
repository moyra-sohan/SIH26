import * as cloudwatch from "@distilled.cloud/aws/cloudwatch";
import * as Layer from "effect/Layer";
import { makeCloudWatchAccountHttpBinding } from "./BindingHttp.js";
import { DescribeAnomalyDetectors } from "./DescribeAnomalyDetectors.js";
export const DescribeAnomalyDetectorsHttp = Layer.effect(DescribeAnomalyDetectors, makeCloudWatchAccountHttpBinding({
    tag: "AWS.CloudWatch.DescribeAnomalyDetectors",
    operation: cloudwatch.describeAnomalyDetectors,
    actions: ["cloudwatch:DescribeAnomalyDetectors"],
}));
//# sourceMappingURL=DescribeAnomalyDetectorsHttp.js.map