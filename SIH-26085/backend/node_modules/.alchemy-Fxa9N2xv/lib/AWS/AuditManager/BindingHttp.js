import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import * as Output from "../../Output.js";
import { isBindingHost } from "../Lambda/Function.js";
/**
 * Shared scaffolding for Audit Manager HTTP bindings.
 *
 * NOT exported from `index.ts` — every `{Op}Http.ts` in this service is a
 * thin `Layer.effect(Cap, make…HttpBinding({ … }))` over one of the two
 * builders below. Everything except the operation, the IAM action list, and
 * (for assessment-scoped operations) the injected `assessmentId` is
 * boilerplate.
 */
/**
 * Build the impl Effect for an assessment-scoped operation: the runtime
 * callable injects the bound {@link Assessment}'s id as `assessmentId` and
 * the deploy-time half grants `actions` on the assessment ARN.
 */
export const makeAssessmentScopedHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (assessment) {
        const AssessmentId = yield* assessment.assessmentId;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${assessment}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: [Output.interpolate `${assessment.arn}`],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${assessment.LogicalId})`)(function* (request) {
            return yield* op({
                ...request,
                assessmentId: yield* AssessmentId,
            });
        });
    });
});
/**
 * Build the impl Effect for an account-level operation (no target assessment
 * — registration status, account-wide insights, report listings, presigned
 * evidence-upload URLs). The deploy-time half grants `actions` on `*`
 * because these IAM actions do not support resource-level scoping.
 */
export const makeAuditManagerAccountHttpBinding = (options) => Effect.gen(function* () {
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