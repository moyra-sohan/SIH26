import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import * as Output from "../../Output.js";
import { AWSEnvironment } from "../Environment.js";
import { isBindingHost } from "../Lambda/Function.js";
/**
 * Resolve the group-scoped schedule ARN pattern the binding is granted on.
 * Passes unresolved Outputs — binding data is resolved by the engine before
 * the host reconciles.
 */
const scheduleArnPattern = Effect.fn(function* (group) {
    const { accountId, region } = yield* AWSEnvironment.current;
    return group
        ? Output.interpolate `arn:aws:scheduler:${region}:${accountId}:schedule/${group.scheduleGroupName}/*`
        : `arn:aws:scheduler:${region}:${accountId}:schedule/default/*`;
});
/**
 * Account-wide schedule ARN pattern — the resource IAM evaluates
 * `scheduler:ListSchedules` against, regardless of any `GroupName` filter in
 * the request.
 */
const allSchedulesArnPattern = Effect.gen(function* () {
    const { accountId, region } = yield* AWSEnvironment.current;
    return `arn:aws:scheduler:${region}:${accountId}:schedule/*/*`;
});
/**
 * Build the impl Effect for a group-scoped Scheduler operation: the
 * deploy-time half grants `actions` on the group's schedule ARN pattern, and
 * the runtime half injects the group's name as the request's `GroupName`.
 */
export const makeScheduleGroupScopedHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (group) {
        const GroupName = group ? yield* group.scheduleGroupName : undefined;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                const pattern = options.resourceScope === "all"
                    ? yield* allSchedulesArnPattern
                    : yield* scheduleArnPattern(group);
                yield* host.bind `Allow(${host}, ${options.tag}(${group ?? "default"}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: [pattern],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${group?.LogicalId ?? "default"})`)(function* (request) {
            const groupName = GroupName
                ? yield* GroupName
                : options.fallbackGroupName;
            return yield* op({
                ...request,
                GroupName: groupName,
            });
        });
    });
});
/**
 * Build the impl Effect for a Scheduler write operation
 * (`CreateSchedule`/`UpdateSchedule`): constructed with the schedule
 * execution role (plus an optional scoping {@link ScheduleGroup}), the
 * deploy-time half grants `actions` on the group's schedule ARN pattern AND
 * `iam:PassRole` on the execution role; the runtime half injects the group's
 * name, defaults `FlexibleTimeWindow` to `{ Mode: "OFF" }`, and defaults the
 * target's `RoleArn` to the bound execution role.
 */
export const makeScheduleWriteHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (executionRole, group) {
        const RoleArn = yield* executionRole.roleArn;
        const GroupName = group ? yield* group.scheduleGroupName : undefined;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                const pattern = yield* scheduleArnPattern(group);
                yield* host.bind `Allow(${host}, ${options.tag}(${executionRole}, ${group ?? "default"}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: [pattern],
                        },
                        // CRITICAL: without iam:PassRole on the execution role, the
                        // write fails only at runtime with an AccessDenied.
                        {
                            Effect: "Allow",
                            Action: ["iam:PassRole"],
                            Resource: [Output.interpolate `${executionRole.roleArn}`],
                            Condition: {
                                StringEquals: {
                                    "iam:PassedToService": "scheduler.amazonaws.com",
                                },
                            },
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${executionRole.LogicalId})`)(function* (request) {
            const roleArn = yield* RoleArn;
            const groupName = GroupName ? yield* GroupName : undefined;
            return yield* op({
                ...request,
                GroupName: groupName,
                FlexibleTimeWindow: request.FlexibleTimeWindow ?? { Mode: "OFF" },
                Target: {
                    ...request.Target,
                    RoleArn: request.Target.RoleArn ?? roleArn,
                },
            });
        });
    });
});
//# sourceMappingURL=BindingHttp.js.map