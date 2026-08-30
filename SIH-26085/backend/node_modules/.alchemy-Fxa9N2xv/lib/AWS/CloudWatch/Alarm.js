import * as cloudwatch from "@distilled.cloud/aws/cloudwatch";
import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";
import { Unowned } from "../../AdoptPolicy.js";
import { isResolved } from "../../Diff.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
import { hasAlchemyTags } from "../../Tags.js";
import { AWSEnvironment } from "../Environment.js";
import { createName, readResourceTags, retryConcurrent, updateResourceTags, } from "./common.js";
/**
 * A CloudWatch metric alarm — watches a single metric (or metric-math
 * expression) and transitions between `OK`, `ALARM`, and
 * `INSUFFICIENT_DATA`, optionally firing actions on state change.
 * ### Creating Alarms
 * **Example:** Threshold Alarm
 * ```typescript
 * const alarm = yield* Alarm("HighErrors", {
 *   MetricName: "Errors",
 *   Namespace: "AWS/Lambda",
 *   Statistic: "Sum",
 *   Period: 60,
 *   EvaluationPeriods: 1,
 *   Threshold: 1,
 *   ComparisonOperator: "GreaterThanOrEqualToThreshold",
 * });
 * ```
 *
 * **Example:** Alarm on a Lambda Function's Errors
 * ```typescript
 * const fn = yield* MyFunction;
 *
 * const alarm = yield* Alarm("FnErrors", {
 *   MetricName: "Errors",
 *   Namespace: "AWS/Lambda",
 *   Dimensions: [{ Name: "FunctionName", Value: fn.functionName }],
 *   Statistic: "Sum",
 *   Period: 60,
 *   EvaluationPeriods: 1,
 *   Threshold: 1,
 *   ComparisonOperator: "GreaterThanOrEqualToThreshold",
 *   TreatMissingData: "notBreaching",
 * });
 * ```
 *
 * ### Reading Alarm State at Runtime
 * **Example:** Read the Alarm's State from a Function
 * ```typescript
 * // init — bind the alarm to the function (see DescribeAlarms)
 * const describeAlarms = yield* AWS.CloudWatch.DescribeAlarms(alarm);
 *
 * // runtime
 * const result = yield* describeAlarms();
 * const state = result.MetricAlarms?.[0]?.StateValue;
 * ```
 *
 * @resource
 */
export const Alarm = Resource("AWS.CloudWatch.Alarm");
export const AlarmProvider = () => Provider.effect(Alarm, Effect.gen(function* () {
    const createAlarmName = (id, props = {}) => createName(id, props.name, 255);
    const alarmArn = (alarmName) => AWSEnvironment.current.pipe(Effect.map((env) => `arn:aws:cloudwatch:${env.region}:${env.accountId}:alarm:${alarmName}`));
    const readAlarm = Effect.fn(function* (alarmName) {
        const described = yield* cloudwatch.describeAlarms({
            AlarmNames: [alarmName],
            AlarmTypes: ["MetricAlarm"],
        });
        const metricAlarm = described.MetricAlarms?.find((candidate) => candidate.AlarmName === alarmName);
        if (!metricAlarm?.AlarmName || !metricAlarm.AlarmArn) {
            return undefined;
        }
        const tags = yield* readResourceTags(metricAlarm.AlarmArn).pipe(Effect.catchTag("ResourceNotFoundException", () => Effect.succeed({})));
        return {
            alarmName: metricAlarm.AlarmName,
            alarmArn: metricAlarm.AlarmArn,
            stateValue: metricAlarm.StateValue,
            stateReason: metricAlarm.StateReason,
            metricAlarm,
            tags,
        };
    });
    return {
        stables: ["alarmName", "alarmArn"],
        diff: Effect.fn(function* ({ id, olds = {}, news = {} }) {
            if (!isResolved(news))
                return undefined;
            const oldName = yield* createAlarmName(id, olds);
            const newName = yield* createAlarmName(id, news);
            if (oldName !== newName) {
                return { action: "replace" };
            }
        }),
        // Enumerate every MetricAlarm in the account/region by exhaustively
        // paginating `describeAlarms` filtered to `MetricAlarm` (CompositeAlarm
        // is owned by a separate resource). Each item is mapped to the same
        // Attributes shape `read` produces, fetching tags per alarm.
        list: () => Effect.gen(function* () {
            const alarms = yield* cloudwatch.describeAlarms
                .pages({ AlarmTypes: ["MetricAlarm"] })
                .pipe(Stream.runCollect, Effect.map((chunk) => Array.from(chunk).flatMap((page) => page.MetricAlarms ?? [])));
            const attrs = yield* Effect.forEach(alarms.filter((metricAlarm) => metricAlarm.AlarmName != null && metricAlarm.AlarmArn != null), (metricAlarm) => Effect.gen(function* () {
                const tags = yield* readResourceTags(metricAlarm.AlarmArn).pipe(Effect.catchTag("ResourceNotFoundException", () => Effect.succeed({})));
                return {
                    alarmName: metricAlarm.AlarmName,
                    alarmArn: metricAlarm.AlarmArn,
                    stateValue: metricAlarm.StateValue,
                    stateReason: metricAlarm.StateReason,
                    metricAlarm,
                    tags,
                };
            }), { concurrency: 10 });
            return attrs;
        }),
        read: Effect.fn(function* ({ id, olds, output }) {
            const name = output?.alarmName ?? (yield* createAlarmName(id, olds ?? {}));
            const state = yield* readAlarm(name);
            if (!state)
                return undefined;
            return (yield* hasAlchemyTags(id, state.tags))
                ? state
                : Unowned(state);
        }),
        reconcile: Effect.fn(function* ({ id, news, olds, output, session }) {
            // Observe — derive the alarm name and read whatever is currently
            // in CloudWatch under that name. `output.alarmName` wins when
            // present so an existing physical resource is never renamed.
            const name = output?.alarmName ?? (yield* createAlarmName(id, news));
            const existing = yield* readAlarm(name);
            // Ensure — `putMetricAlarm` is an upsert; we always send the full
            // desired config so the cloud converges to `news` regardless of
            // whether the alarm pre-existed.
            yield* retryConcurrent(cloudwatch.putMetricAlarm({
                ...news,
                AlarmName: name,
            }));
            // Sync tags — diff observed (or prior) tags against desired and
            // apply only the delta. On adoption `olds` is undefined, so we
            // fall back to whatever we just observed.
            const tags = yield* updateResourceTags({
                id,
                resourceArn: yield* alarmArn(name),
                olds: olds?.tags ?? existing?.tags,
                news: news.tags,
            });
            yield* session.note(yield* alarmArn(name));
            const state = yield* readAlarm(name);
            if (!state) {
                return yield* Effect.fail(new Error(`failed to read reconciled alarm '${name}'`));
            }
            return {
                ...state,
                tags,
            };
        }),
        delete: Effect.fn(function* ({ output }) {
            yield* retryConcurrent(cloudwatch.deleteAlarms({
                AlarmNames: [output.alarmName],
            }));
        }),
    };
}));
//# sourceMappingURL=Alarm.js.map