import * as cloudwatch from "@distilled.cloud/aws/cloudwatch";
import * as Layer from "effect/Layer";
import { makeCloudWatchAccountHttpBinding } from "./BindingHttp.js";
import { DescribeAlarmHistory } from "./DescribeAlarmHistory.js";
export const DescribeAlarmHistoryHttp = Layer.effect(DescribeAlarmHistory, makeCloudWatchAccountHttpBinding({
    tag: "AWS.CloudWatch.DescribeAlarmHistory",
    operation: cloudwatch.describeAlarmHistory,
    actions: ["cloudwatch:DescribeAlarmHistory"],
}));
//# sourceMappingURL=DescribeAlarmHistoryHttp.js.map