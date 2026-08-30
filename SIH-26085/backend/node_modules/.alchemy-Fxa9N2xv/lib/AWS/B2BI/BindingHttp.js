import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import * as Output from "../../Output.js";
import { isBindingHost } from "../Lambda/Function.js";
/**
 * Shared scaffolding for B2BI HTTP bindings.
 *
 * NOT exported from `index.ts` — every `{Op}Http.ts` in this service is a
 * thin `Layer.effect(Cap, make…HttpBinding({ … }))` over one of the two
 * builders below. Everything except the operation, the IAM action list, and
 * the injected identifier is boilerplate.
 */
/**
 * Build the impl Effect for a transformer-scoped operation: the runtime
 * callable injects the bound {@link Transformer}'s ID as `transformerId` and
 * the deploy-time half grants `actions` on the transformer ARN.
 */
export const makeTransformerScopedHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (transformer) {
        const TransformerId = yield* transformer.transformerId;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${transformer}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: [Output.interpolate `${transformer.transformerArn}`],
                        },
                        ...(options.companionStatements ?? []),
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${transformer.LogicalId})`)(function* (request) {
            return yield* op({
                ...request,
                transformerId: yield* TransformerId,
            });
        });
    });
});
/**
 * Build the impl Effect for an account-level operation (no target resource).
 * The deploy-time half grants `actions` on `*` — B2BI's test/generate
 * operations don't support resource-level scoping.
 */
export const makeB2biAccountHttpBinding = (options) => Effect.gen(function* () {
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