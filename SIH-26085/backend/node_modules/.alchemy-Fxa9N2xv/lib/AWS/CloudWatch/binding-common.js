import { sortByLogicalId } from "./common.js";
export const sortAlarmResources = (alarms) => sortByLogicalId(alarms);
export const sortInsightRuleResources = (rules) => sortByLogicalId(rules);
export const getTaggableResourceArn = (resource) => {
    switch (resource.Type) {
        case "AWS.CloudWatch.Alarm":
        case "AWS.CloudWatch.CompositeAlarm":
            return resource.alarmArn;
        case "AWS.CloudWatch.Dashboard":
            return resource.dashboardArn;
        case "AWS.CloudWatch.MetricStream":
            return resource.metricStreamArn;
        case "AWS.CloudWatch.InsightRule":
            return resource.ruleArn;
        case "AWS.CloudWatch.AlarmMuteRule":
            return resource.alarmMuteRuleArn;
    }
};
//# sourceMappingURL=binding-common.js.map