import * as analytics from "@distilled.cloud/aws/kinesis-analytics-v2";
import * as Layer from "effect/Layer";
import { makeKinesisAnalyticsHttpBinding } from "./BindingHttp.js";
import { DescribeApplicationOperation } from "./DescribeApplicationOperation.js";
export const DescribeApplicationOperationHttp = Layer.effect(DescribeApplicationOperation, makeKinesisAnalyticsHttpBinding({
    tag: "AWS.KinesisAnalyticsV2.DescribeApplicationOperation",
    operation: analytics.describeApplicationOperation,
    actions: ["kinesisanalytics:DescribeApplicationOperation"],
}));
//# sourceMappingURL=DescribeApplicationOperationHttp.js.map