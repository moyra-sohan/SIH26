import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import { isBindingHost } from "../Lambda/Function.js";
/**
 * Shared scaffolding for the Amazon HealthOmics HTTP bindings.
 *
 * Every Omics data-plane operation is either addressed by a store/workflow id
 * (read-set jobs by `sequenceStoreId`, reference jobs by `referenceStoreId`,
 * runs by `workflowId`) or account-level (run control by `runId`, a runtime
 * value). Two builders cover both shapes; every thin `{Op}Http.ts` in this
 * service is a `Layer.effect(Cap, make…HttpBinding({ … }))`.
 *
 * NOT exported from `index.ts` — leaking the generic helper names into the
 * flat `AWS` namespace would collide across services.
 */
/**
 * Build the impl Effect for a resource-scoped operation: the runtime callable
 * injects the bound resource's id under `key` (`sequenceStoreId`,
 * `referenceStoreId`, or `workflowId`) and the deploy-time half grants
 * `actions` on the resource ARN. Operations that hand the service a role to
 * assume (`Start*ImportJob`, `Start*ExportJob`, `StartRun`) set `passRole`.
 */
export const makeOmicsResourceHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (res) {
        // Outputs yield a DEFERRED effect — resolve again per invocation below.
        const Id = yield* options.id(res);
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                // Inline (not a `PolicyStatement[]`-typed local) so the bind data's
                // `Input<…>` contextual typing accepts the `Output<string>` ARN.
                yield* host.bind `Allow(${host}, ${options.tag}(${res}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: [options.arn(res)],
                        },
                        ...(options.passRole
                            ? [
                                {
                                    Effect: "Allow",
                                    Action: ["iam:PassRole"],
                                    Resource: ["*"],
                                    Condition: {
                                        StringEquals: {
                                            "iam:PassedToService": "omics.amazonaws.com",
                                        },
                                    },
                                },
                            ]
                            : []),
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${res.LogicalId})`)(function* (request) {
            return yield* op({ ...request, [options.key]: yield* Id });
        });
    });
});
/**
 * Build the impl Effect for an account-level run-control operation
 * (`GetRun`, `ListRuns`, `CancelRun`, `DeleteRun`, `GetRunTask`,
 * `ListRunTasks`): the runtime callable passes the caller's request through
 * unchanged (the `runId` is a runtime value) and the deploy-time half grants
 * `actions` on `*`.
 */
export const makeOmicsAccountHttpBinding = (options) => Effect.gen(function* () {
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
            return yield* op((request ?? {}));
        });
    });
});
//# sourceMappingURL=BindingHttp.js.map