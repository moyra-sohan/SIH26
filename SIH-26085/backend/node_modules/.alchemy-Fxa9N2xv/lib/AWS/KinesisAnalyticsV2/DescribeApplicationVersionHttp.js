import * as analytics from "@distilled.cloud/aws/kinesis-analytics-v2";
import * as Layer from "effect/Layer";
import { makeKinesisAnalyticsHttpBinding } from "./BindingHttp.js";
import { DescribeApplicationVersion } from "./DescribeApplicationVersion.js";
export const DescribeApplicationVersionHttp = Layer.effect(DescribeApplicationVersion, makeKinesisAnalyticsHttpBinding({
    tag: "AWS.KinesisAnalyticsV2.DescribeApplicationVersion",
    operation: analytics.describeApplicationVersion,
    actions: ["kinesisanalytics:DescribeApplicationVersion"],
}));
//# sourceMappingURL=DescribeApplicationVersionHttp.js.map