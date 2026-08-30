import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import { isBindingHost } from "../Lambda/Function.js";
/**
 * Shared scaffolding for AppFlow per-operation HTTP bindings.
 *
 * Every AppFlow runtime binding follows the same recipe: resolve the
 * identifier (flow name / connector profile name), register the IAM grant on
 * the binding host at deploy time, then invoke the distilled operation with
 * the identifier injected. This factory owns that recipe so each `{Op}Http.ts`
 * is a thin `Layer.effect(Cap, makeAppFlowHttpBinding({ ... }))` call whose
 * request/response/error types are still checked against the capability
 * contract at the `Layer.effect` site.
 *
 * Internal scaffolding — NOT exported from `index.ts`.
 */
export const makeAppFlowHttpBinding = (options) => Effect.gen(function* () {
    const operation = yield* options.operation;
    return Effect.fn(function* (resource) {
        const Identifier = yield* options.identifier(resource);
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, AWS.AppFlow.${options.action}(${resource}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [`appflow:${options.action}`],
                            Resource: options.resources(resource),
                        },
                    ],
                });
            }
        }
        return Effect.fn(`AWS.AppFlow.${options.action}(${resource.LogicalId})`)(function* (request) {
            // The compiler cannot relate `Omit<I, K>` plus a computed generic
            // key back to `I`, so the identifier injection carries one
            // contained cast. Concrete request/response types are still fully
            // checked where each `Layer.effect(Cap, ...)` matches this factory's
            // inferred shape against the capability contract.
            return yield* operation({
                ...request,
                [options.requestKey]: yield* Identifier,
            });
        });
    });
});
//# sourceMappingURL=BindingHttp.js.map