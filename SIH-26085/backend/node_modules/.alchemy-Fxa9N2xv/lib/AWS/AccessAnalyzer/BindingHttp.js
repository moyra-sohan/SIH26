import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import * as Output from "../../Output.js";
import { isBindingHost } from "../Lambda/Function.js";
/**
 * Shared scaffolding for AccessAnalyzer HTTP bindings.
 *
 * NOT exported from `index.ts` — every `{Op}Http.ts` in this service is a
 * thin `Layer.effect(Cap, make…HttpBinding({ … }))` over one of the two
 * builders below. Everything except the operation, the IAM action list, and
 * (for analyzer-scoped operations) the injected `analyzerArn` is boilerplate.
 */
/**
 * Build the impl Effect for an analyzer-scoped operation: the runtime
 * callable injects the bound {@link Analyzer}'s ARN as `analyzerArn` and the
 * deploy-time half grants `actions` on the analyzer ARN.
 */
export const makeAnalyzerScopedHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (analyzer) {
        const AnalyzerArn = yield* analyzer.analyzerArn;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${analyzer}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: [Output.interpolate `${analyzer.analyzerArn}`],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${analyzer.LogicalId})`)(function* (request) {
            return yield* op({
                ...request,
                analyzerArn: yield* AnalyzerArn,
            });
        });
    });
});
/**
 * Build the impl Effect for an account-level operation (no target analyzer —
 * the policy-check, policy-validation, and policy-generation APIs). The
 * deploy-time half grants `actions` on `*` because these IAM actions do not
 * support resource-level scoping.
 */
export const makeAccessAnalyzerAccountHttpBinding = (options) => Effect.gen(function* () {
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