import * as cloudwatch from "@distilled.cloud/aws/cloudwatch";
import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import * as Layer from "effect/Layer";
import { isBindingHost } from "../Lambda/Function.js";
import { sortAlarmResources } from "./binding-common.js";
import { DescribeAlarms, } from "./DescribeAlarms.js";
export const DescribeAlarmsHttp = Layer.effect(DescribeAlarms, Effect.gen(function* () {
    const describeAlarms = yield* cloudwatch.describeAlarms;
    return Effect.fn(function* (...alarms) {
        const sorted = sortAlarmResources(alarms);
        const AlarmNames = yield* Effect.forEach(sorted, (alarm) => alarm.alarmName.asEffect());
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, AWS.CloudWatch.DescribeAlarms(${sorted}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: ["cloudwatch:DescribeAlarms"],
                            // AWS requires "*" here to return composite alarms.
                            Resource: ["*"],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`AWS.CloudWatch.DescribeAlarms(${sorted})`)(function* (request = {}) {
            return yield* describeAlarms({
                ...request,
                AlarmTypes: getAlarmTypes(sorted),
                AlarmNames: yield* Effect.forEach(AlarmNames, (alarmName) => alarmName),
            });
        });
    });
}));
const getAlarmTypes = (alarms) => [
    ...new Set(alarms.map((alarm) => alarm.Type === "AWS.CloudWatch.CompositeAlarm"
        ? "CompositeAlarm"
        : "MetricAlarm")),
];
//# sourceMappingURL=DescribeAlarmsHttp.js.map