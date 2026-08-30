import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import * as Output from "../../Output.js";
import { isBindingHost } from "../Lambda/Function.js";
/**
 * Shared scaffolding for AWS Step Functions HTTP bindings.
 *
 * NOT exported from `index.ts` — every near-identical `{Op}Http.ts` in this
 * service is a thin `Layer.effect(Cap, make…HttpBinding({ … }))` over one of
 * the builders below. Everything except the operation, the IAM action list,
 * and the injected/derived identifier is boilerplate. Genuinely-different
 * bindings (none currently — `StartSyncExecution` folds its bespoke
 * `sync-states` endpoint into the `operation` effect it passes) stay
 * bespoke.
 */
/**
 * Execution ARNs replace the `:stateMachine:` segment with `:execution:`
 * and append the execution name — grant on the machine's execution ARN
 * pattern.
 */
export const executionArnPattern = (stateMachine) => Output.map(stateMachine.stateMachineArn, (arn) => `${arn.replace(":stateMachine:", ":execution:")}:*`);
/**
 * Map Run ARNs replace the `:stateMachine:` segment with `:mapRun:` and
 * append `/{executionName}:{uuid}` — grant on the machine's Map Run ARN
 * pattern.
 */
export const mapRunArnPattern = (stateMachine) => Output.map(stateMachine.stateMachineArn, (arn) => `${arn.replace(":stateMachine:", ":mapRun:")}/*`);
const grant = (tag, scope, actions, resources) => Effect.gen(function* () {
    if (!globalThis.__ALCHEMY_RUNTIME__) {
        const host = yield* Binding.Host;
        if (isBindingHost(host)) {
            yield* host.bind `Allow(${host}, ${tag}(${scope}))`({
                policyStatements: [
                    {
                        Effect: "Allow",
                        Action: [...actions],
                        Resource: [...resources],
                    },
                ],
            });
        }
    }
});
/**
 * Build the impl Effect for a state-machine-scoped operation whose request
 * carries the machine identity as `stateMachineArn` (`StartExecution`,
 * `ListExecutions`, …): the runtime callable injects the bound
 * {@link StateMachine}'s ARN and the deploy-time half grants `actions` on
 * it.
 */
export const makeStateMachineArnHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (stateMachine) {
        const StateMachineArn = yield* stateMachine.stateMachineArn;
        yield* grant(options.tag, stateMachine, options.actions, [
            stateMachine.stateMachineArn,
        ]);
        return Effect.fn(`${options.tag}(${stateMachine.LogicalId})`)(function* (request) {
            return yield* op({
                ...request,
                stateMachineArn: yield* StateMachineArn,
            });
        });
    });
});
/**
 * Build the impl Effect for an operation addressed by an execution or Map
 * Run ARN the caller already holds (`DescribeExecution`, `StopExecution`,
 * `GetExecutionHistory`, `RedriveExecution`, `DescribeMapRun`, …): the
 * runtime callable passes the request through unchanged while the
 * deploy-time half grants `actions` on the bound {@link StateMachine}'s
 * execution (or Map Run) ARN pattern.
 */
export const makeExecutionScopedHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (stateMachine) {
        yield* grant(options.tag, stateMachine, options.actions, [
            options.scope === "mapRun"
                ? mapRunArnPattern(stateMachine)
                : executionArnPattern(stateMachine),
        ]);
        return Effect.fn(`${options.tag}(${stateMachine.LogicalId})`)(function* (request) {
            return yield* op(request);
        });
    });
});
/**
 * Build the impl Effect for an activity-scoped operation whose request
 * carries the activity identity as `activityArn` (`GetActivityTask`): the
 * runtime callable injects the bound {@link Activity}'s ARN and the
 * deploy-time half grants `actions` on it.
 */
export const makeActivityArnHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (activity) {
        const ActivityArn = yield* activity.activityArn;
        yield* grant(options.tag, activity, options.actions, [
            activity.activityArn,
        ]);
        return Effect.fn(`${options.tag}(${activity.LogicalId})`)(function* (request) {
            return yield* op({
                ...request,
                activityArn: yield* ActivityArn,
            });
        });
    });
});
/**
 * Build the impl Effect for a task-token callback operation
 * (`SendTaskSuccess`/`SendTaskFailure`/`SendTaskHeartbeat`): task tokens
 * from `.waitForTaskToken` service integrations carry no IAM resource, so
 * the grant is `*` unless an {@link Activity} is bound (only Activity tasks
 * support resource-level scoping). The request passes through unchanged.
 */
export const makeTaskCallbackHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (activity) {
        yield* grant(options.tag, activity ?? "*", options.actions, [
            activity ? Output.interpolate `${activity.activityArn}` : "*",
        ]);
        return Effect.fn(`${options.tag}(${activity?.LogicalId})`)(function* (request) {
            return yield* op(request);
        });
    });
});
/**
 * Build the impl Effect for a zero-arity, service-scoped Step Functions
 * binding (`TestState`, `ValidateStateMachineDefinition`): registers the
 * service-scoped IAM policy statement on the host (deploy time) and passes
 * the request through unchanged (runtime).
 */
export const makeSfnServiceHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* () {
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}())`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: ["*"],
                        },
                    ],
                });
            }
        }
        return Effect.fn(options.tag)(function* (request) {
            return yield* op(request);
        });
    });
});
//# sourceMappingURL=BindingHttp.js.map