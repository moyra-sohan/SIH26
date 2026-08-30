import * as cloudwatch from "@distilled.cloud/aws/cloudwatch";
import * as Layer from "effect/Layer";
import { makeCloudWatchResourceHttpBinding } from "./BindingHttp.js";
import { DescribeAlarmContributors } from "./DescribeAlarmContributors.js";
export const DescribeAlarmContributorsHttp = Layer.effect(DescribeAlarmContributors, makeCloudWatchResourceHttpBinding({
    tag: "AWS.CloudWatch.DescribeAlarmContributors",
    operation: cloudwatch.describeAlarmContributors,
    actions: ["cloudwatch:DescribeAlarmContributors"],
    requestKey: "AlarmName",
    identifier: (alarm) => alarm.alarmName,
    resourceArn: (alarm) => alarm.alarmArn,
}));
//# sourceMappingURL=DescribeAlarmContributorsHttp.js.map