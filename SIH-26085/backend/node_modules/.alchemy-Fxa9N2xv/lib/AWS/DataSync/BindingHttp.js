import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import * as Output from "../../Output.js";
import { isBindingHost } from "../Lambda/Function.js";
/**
 * Shared scaffolding for AWS DataSync HTTP bindings.
 *
 * NOT exported from `index.ts` — every `{Op}Http.ts` in this service is a
 * thin `Layer.effect(Cap, make…HttpBinding({ … }))` over one of the two
 * builders below. Everything except the operation and the IAM action is
 * boilerplate.
 *
 * DataSync authorizes task-addressed actions against the *task* ARN
 * (`arn:…:task/task-id`) and execution-addressed actions against the
 * *task execution* ARN (`arn:…:task/task-id/execution/exec-id`), so every
 * builder grants on both the bound task's ARN and its execution pattern.
 */
const taskPolicyStatement = (task, actions) => ({
    Effect: "Allow",
    Action: [...actions],
    Resource: [
        Output.interpolate `${task.taskArn}`,
        Output.map(task.taskArn, (arn) => `${arn}/execution/*`),
    ],
});
/**
 * Build the impl Effect for an operation whose input carries a `TaskArn`
 * field: the runtime callable injects the bound {@link Task}'s ARN and the
 * deploy-time half grants `actions` on the task ARN (and its execution
 * pattern).
 */
export const makeDataSyncTaskHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (task) {
        // Outputs yield a DEFERRED effect — resolve again per invocation below.
        const TaskArn = yield* task.taskArn;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${task}))`({
                    policyStatements: [taskPolicyStatement(task, options.actions)],
                });
            }
        }
        return Effect.fn(`${options.tag}(${task.LogicalId})`)(function* (request) {
            return yield* op({ ...request, TaskArn: yield* TaskArn });
        });
    });
});
/**
 * Build the impl Effect for a task-anchored operation whose input addresses
 * a task *execution* by ARN (returned by `StartTaskExecution`): the request
 * passes through as-is and the deploy-time half grants `actions` on the
 * bound task's ARN + execution pattern.
 */
export const makeDataSyncTaskExecutionHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (task) {
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${task}))`({
                    policyStatements: [taskPolicyStatement(task, options.actions)],
                });
            }
        }
        return Effect.fn(`${options.tag}(${task.LogicalId})`)(function* (request) {
            return yield* op(request);
        });
    });
});
//# sourceMappingURL=BindingHttp.js.map