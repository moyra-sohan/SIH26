import * as Effect from "effect/Effect";
import * as IAM from "../IAM/index.js";
import { Schedule } from "./Schedule.js";
export const every = (value, options = {}) => makeBuilder({
    expression: value.startsWith("rate(") || value.startsWith("cron(")
        ? value
        : `rate(${value})`,
    ...options,
});
export const cron = (expression, options = {}) => makeBuilder({
    expression,
    ...options,
});
export const at = (date, options = {}) => makeBuilder({
    expression: `at(${date.toISOString().replace(/\.\d{3}Z$/, "Z")})`,
    ...options,
});
const makeBuilder = (state) => ({
    /**
     * The accumulated builder state (expression, name, group, ...). Read by
     * `consumeSchedule` to materialize the schedule against the host Function.
     */
    state,
    named: (name) => makeBuilder({
        ...state,
        name,
    }),
    toLambda: (fn, props = {}) => materializeSchedule(state, fn.LogicalId, [
        {
            Effect: "Allow",
            Action: ["lambda:InvokeFunction"],
            Resource: [fn.functionArn],
        },
    ], {
        Arn: fn.functionArn,
        Input: toInput(props.input),
        RetryPolicy: props.retryPolicy,
        DeadLetterConfig: props.deadLetterConfig,
    }),
    toQueue: (queue, payload, props = {}) => materializeSchedule(state, queue.LogicalId, [
        {
            Effect: "Allow",
            Action: ["sqs:SendMessage"],
            Resource: [queue.queueArn],
        },
    ], {
        Arn: queue.queueArn,
        Input: toInput(payload),
        RetryPolicy: props.retryPolicy,
        DeadLetterConfig: props.deadLetterConfig,
        SqsParameters: props.sqs,
    }),
    toEcsTask: (props) => materializeSchedule(state, props.cluster.LogicalId, [
        {
            Effect: "Allow",
            Action: ["ecs:RunTask"],
            Resource: [props.task.taskDefinitionArn],
        },
        {
            Effect: "Allow",
            Action: ["iam:PassRole"],
            Resource: [props.task.taskRoleArn, props.task.executionRoleArn],
        },
    ], {
        Arn: props.cluster.clusterArn,
        Input: toInput(props.input),
        RetryPolicy: props.retryPolicy,
        DeadLetterConfig: props.deadLetterConfig,
        EcsParameters: {
            TaskDefinitionArn: props.task.taskDefinitionArn,
            TaskCount: props.taskCount ?? 1,
            LaunchType: "FARGATE",
            NetworkConfiguration: {
                awsvpcConfiguration: {
                    Subnets: props.subnets,
                    SecurityGroups: props.securityGroups,
                    AssignPublicIp: props.assignPublicIp ? "ENABLED" : "DISABLED",
                },
            },
        },
    }),
});
const materializeSchedule = (state, targetId, statements, 
// `InputProps` so target fields may carry unresolved `Output`s (e.g. a
// Task's `taskDefinitionArn`); they flow into the `Schedule` resource's
// Input-typed `target` prop and resolve at deploy time.
target) => Effect.gen(function* () {
    const scheduleId = state.name ?? `${targetId}Schedule`;
    const role = yield* IAM.Role(`${scheduleId}Role`, {
        assumeRolePolicyDocument: {
            Version: "2012-10-17",
            Statement: [
                {
                    Effect: "Allow",
                    Principal: {
                        Service: "scheduler.amazonaws.com",
                    },
                    Action: ["sts:AssumeRole"],
                },
            ],
        },
        inlinePolicies: {
            ScheduleTarget: {
                Version: "2012-10-17",
                Statement: statements,
            },
        },
    });
    return yield* Schedule(scheduleId, {
        name: state.name,
        groupName: state.group?.scheduleGroupName,
        scheduleExpression: state.expression,
        startDate: state.startDate,
        endDate: state.endDate,
        description: state.description,
        scheduleExpressionTimezone: state.timezone,
        state: state.state,
        kmsKeyArn: state.kmsKeyArn,
        flexibleTimeWindow: state.flexibleTimeWindow ?? {
            Mode: "OFF",
        },
        actionAfterCompletion: state.actionAfterCompletion,
        target: {
            ...target,
            RoleArn: role.roleArn,
        },
    });
});
const toInput = (value) => value === undefined
    ? undefined
    : typeof value === "string"
        ? value
        : JSON.stringify(value);
//# sourceMappingURL=builders.js.map