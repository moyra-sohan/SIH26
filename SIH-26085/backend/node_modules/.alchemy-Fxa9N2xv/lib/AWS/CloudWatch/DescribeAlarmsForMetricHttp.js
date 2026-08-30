import * as cloudwatch from "@distilled.cloud/aws/cloudwatch";
import * as Layer from "effect/Layer";
import { makeCloudWatchAccountHttpBinding } from "./BindingHttp.js";
import { DescribeAlarmsForMetric } from "./DescribeAlarmsForMetric.js";
export const DescribeAlarmsForMetricHttp = Layer.effect(DescribeAlarmsForMetric, makeCloudWatchAccountHttpBinding({
    tag: "AWS.CloudWatch.DescribeAlarmsForMetric",
    operation: cloudwatch.describeAlarmsForMetric,
    actions: ["cloudwatch:DescribeAlarmsForMetric"],
}));
//# sourceMappingURL=DescribeAlarmsForMetricHttp.js.map