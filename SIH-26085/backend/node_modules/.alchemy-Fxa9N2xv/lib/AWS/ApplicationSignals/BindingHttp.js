import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import * as Output from "../../Output.js";
import { isBindingHost } from "../Lambda/Function.js";
/**
 * Shared scaffolding for Application Signals HTTP bindings.
 *
 * NOT exported from `index.ts` — every `{Op}Http.ts` in this service is a
 * thin `Layer.effect(Cap, make…HttpBinding({ … }))` over one of the builders
 * below. Everything except the operation, the IAM action list, and (for
 * SLO-scoped operations) the injected identifier is boilerplate.
 */
/**
 * Build the impl Effect for an account-level operation (the service
 * discovery, audit, and change-event read APIs). The deploy-time half
 * grants `actions` on `*` because the Application Signals discovery
 * actions do not support resource-level scoping.
 */
export const makeApplicationSignalsAccountHttpBinding = (options) => Effect.gen(function* () {
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
/**
 * Build the impl Effect for an SLO-scoped operation taking a single `Id`
 * (`GetServiceLevelObjective`, `ListServiceLevelObjectiveExclusionWindows`):
 * the runtime callable injects the bound SLO's ARN as `Id` and the
 * deploy-time half grants `actions` on the SLO ARN.
 */
export const makeSloIdHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (slo) {
        const SloArn = yield* slo.sloArn;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${slo}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: [Output.interpolate `${slo.sloArn}`],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${slo.LogicalId})`)(function* (request) {
            return yield* op({
                ...request,
                Id: yield* SloArn,
            });
        });
    });
});
/**
 * Build the impl Effect for a batch SLO operation taking `SloIds`
 * (`BatchGetServiceLevelObjectiveBudgetReport`,
 * `BatchUpdateExclusionWindows`), narrowed to the single bound SLO: the
 * runtime callable injects `SloIds: [sloArn]` and the deploy-time half
 * grants `actions` on the SLO ARN.
 */
export const makeSloBatchHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (slo) {
        const SloArn = yield* slo.sloArn;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${slo}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: [Output.interpolate `${slo.sloArn}`],
                        },
                        ...(options.accountActions?.length
                            ? [
                                {
                                    Effect: "Allow",
                                    Action: [...options.accountActions],
                                    Resource: ["*"],
                                },
                            ]
                            : []),
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${slo.LogicalId})`)(function* (request) {
            return yield* op({
                ...request,
                SloIds: [yield* SloArn],
            });
        });
    });
});
//# sourceMappingURL=BindingHttp.js.map