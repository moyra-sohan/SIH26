import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import * as Output from "../../Output.js";
import { isBindingHost } from "../Lambda/Function.js";
/**
 * Shared scaffolding for AWS Deadline Cloud HTTP bindings.
 *
 * NOT exported from `index.ts` — every thin `{Op}Http.ts` in this service is
 * a `Layer.effect(Cap, make…HttpBinding({ … }))` over one of the builders
 * below. Everything except the operation, the IAM action list, and the
 * injected identifiers is boilerplate.
 */
/**
 * Build the impl Effect for a queue-scoped job operation. The runtime half
 * injects the bound {@link Queue}'s `farmId` and `queueId` into every
 * request; the deploy-time half grants `actions` on the queue's ARN and on
 * its jobs (`{queueArn}/job/*`), since Deadline authorizes job-level actions
 * (GetJob, UpdateJob, ListSteps, …) against the job resource.
 */
export const makeDeadlineQueueHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (queue) {
        const FarmId = yield* queue.farmId;
        const QueueId = yield* queue.queueId;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${queue}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: [
                                queue.queueArn,
                                queue.queueArn.pipe(Output.map((arn) => `${arn}/job/*`)),
                            ],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${queue.LogicalId})`)(function* (request) {
            return yield* op({
                ...request,
                farmId: yield* FarmId,
                queueId: yield* QueueId,
            });
        });
    });
});
/**
 * Build the impl Effect for a queue-scoped search operation
 * (`SearchJobs`/`SearchSteps`/`SearchTasks` take a `queueIds` array rather
 * than a single `queueId`). The runtime half injects the bound
 * {@link Queue}'s `farmId` and `queueIds: [queueId]`; the deploy-time half
 * grants `actions` on the queue's ARN and its jobs.
 */
export const makeDeadlineQueueSearchHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (queue) {
        const FarmId = yield* queue.farmId;
        const QueueId = yield* queue.queueId;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${queue}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: [
                                queue.queueArn,
                                queue.queueArn.pipe(Output.map((arn) => `${arn}/job/*`)),
                            ],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${queue.LogicalId})`)(function* (request) {
            return yield* op({
                ...request,
                farmId: yield* FarmId,
                queueIds: [yield* QueueId],
            });
        });
    });
});
/**
 * Build the impl Effect for a farm-scoped operation (usage statistics
 * aggregations). The runtime half injects the bound {@link Farm}'s `farmId`;
 * the deploy-time half grants `actions` on the farm's ARN and everything
 * under it (queues/fleets referenced by the aggregation's `resourceIds`).
 */
export const makeDeadlineFarmHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (farm) {
        const FarmId = yield* farm.farmId;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${farm}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: [
                                farm.farmArn,
                                farm.farmArn.pipe(Output.map((arn) => `${arn}/*`)),
                            ],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${farm.LogicalId})`)(function* (request) {
            return yield* op({ ...request, farmId: yield* FarmId });
        });
    });
});
//# sourceMappingURL=BindingHttp.js.map