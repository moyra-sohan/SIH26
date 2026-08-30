import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import { isBindingHost } from "./Function.js";
/**
 * Shared scaffolding for AWS Lambda control/data-plane HTTP bindings.
 *
 * NOT exported from `index.ts` — every near-identical `{Op}Http.ts` in this
 * service is a thin `Layer.effect(Cap, make…HttpBinding({ … }))` over one of
 * the builders below. Everything except the operation, the IAM action list,
 * and the granted ARNs is boilerplate. Genuinely-different bindings (the
 * MicroVM family with its cross-cloud credential scaffolding in
 * `MicrovmBinding.ts`) stay bespoke.
 */
/**
 * Build the impl Effect for a function-scoped operation (`Invoke`,
 * `GetFunction`, `InvokeWithResponseStream`): the runtime callable injects
 * the bound {@link Function}'s ARN as `FunctionName` and the deploy-time
 * half grants `actions` on `resources` (default: the function ARN).
 */
export const makeFunctionHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (func) {
        const FunctionArn = yield* func.functionArn;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${func}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: options.resources?.(func) ?? [func.functionArn],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${func.LogicalId})`)(function* (request) {
            return yield* op({
                ...request,
                FunctionName: yield* FunctionArn,
            });
        });
    });
});
/**
 * Build the impl Effect for an account-level operation
 * (`GetAccountSettings`, `ListFunctions`): the runtime callable passes the
 * caller's request through unchanged and the deploy-time half grants
 * `actions` on `*` (these Lambda actions do not support resource-level
 * permissions).
 */
export const makeLambdaAccountHttpBinding = (options) => Effect.gen(function* () {
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