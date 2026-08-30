import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import { isBindingHost } from "../Lambda/Function.js";
/**
 * Shared HTTP scaffolding for the IAM Roles Anywhere runtime bindings.
 *
 * Subjects (the certificate identities Roles Anywhere records for every
 * authentication attempt) are account-scoped audit records chosen per request
 * at runtime, so every binding is account-level and grants its action(s) on
 * `Resource: ["*"]`.
 *
 * NOT exported from `index.ts` — every thin `{Op}Http.ts` in this service is
 * a `Layer.effect(Cap, makeRolesAnywhereHttpBinding({ … }))` over the builder
 * below. Everything except the operation and the IAM action list is
 * boilerplate.
 */
export const makeRolesAnywhereHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* () {
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                const policyStatements = [
                    {
                        Effect: "Allow",
                        Action: [...options.iamActions],
                        // The target subjects are chosen per request at runtime.
                        Resource: ["*"],
                    },
                ];
                yield* host.bind `Allow(${host}, AWS.RolesAnywhere.${options.capability}())`({
                    policyStatements,
                });
            }
        }
        return Effect.fn(`AWS.RolesAnywhere.${options.capability}`)(function* (request) {
            return yield* op((request ?? {}));
        });
    });
});
//# sourceMappingURL=BindingHttp.js.map