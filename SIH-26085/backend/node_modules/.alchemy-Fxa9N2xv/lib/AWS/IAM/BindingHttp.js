import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import { isBindingHost } from "../Lambda/Function.js";
/**
 * Shared HTTP scaffolding for the IAM audit/insight runtime bindings.
 *
 * IAM's runtime surface (policy simulation, credential reports, access
 * advisor, account audit) targets *arbitrary* IAM entities discovered at
 * runtime — e.g. a compliance Lambda iterating every role in the account —
 * so every binding is account-level and grants its action(s) on
 * `Resource: ["*"]` (where AWS scopes the action to an entity, the entity is
 * chosen per request and unknowable at deploy time). The only variation
 * between bindings is the distilled operation and the IAM action.
 *
 * NOT exported from `index.ts` — every thin `{Op}Http.ts` in this service is
 * a `Layer.effect(Cap, makeIamHttpBinding({ … }))`. Genuinely-different
 * bindings (e.g. `GetAccessKeyLastUsed`, which injects the identifier of a
 * bound canonical `AccessKey`) stay bespoke.
 */
export const makeIamHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* () {
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                const policyStatements = [
                    {
                        Effect: "Allow",
                        Action: [...options.iamActions],
                        // The target IAM entities are chosen per request at runtime.
                        Resource: ["*"],
                    },
                ];
                yield* host.bind `Allow(${host}, AWS.IAM.${options.capability}())`({
                    policyStatements,
                });
            }
        }
        return Effect.fn(`AWS.IAM.${options.capability}`)(function* (request) {
            return yield* op((request ?? {}));
        });
    });
});
//# sourceMappingURL=BindingHttp.js.map