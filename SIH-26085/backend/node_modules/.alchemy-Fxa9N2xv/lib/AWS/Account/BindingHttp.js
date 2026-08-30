import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import { isBindingHost } from "../Lambda/Function.js";
/**
 * Shared HTTP scaffolding for the AWS Account Management runtime bindings.
 *
 * Account Management is an account-singleton global service: every runtime
 * operation reads settings of the calling account (account information,
 * primary/alternate contacts, Region opt statuses), so every binding is
 * account-level and grants its action(s) on `Resource: ["*"]` (the account
 * ARN is the caller's own account, fixed by the credentials rather than
 * chosen per resource).
 *
 * NOT exported from `index.ts` — every thin `{Op}Http.ts` in this service is
 * a `Layer.effect(Cap, makeAccountHttpBinding({ … }))` over the builder
 * below. Everything except the operation and the IAM action list is
 * boilerplate.
 */
export const makeAccountHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* () {
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                const policyStatements = [
                    {
                        Effect: "Allow",
                        Action: [...options.iamActions],
                        // Account Management operations act on the calling account
                        // itself (identified by the credentials, not a per-resource
                        // ARN chosen at deploy time).
                        Resource: ["*"],
                    },
                ];
                yield* host.bind `Allow(${host}, AWS.Account.${options.capability}())`({
                    policyStatements,
                });
            }
        }
        return Effect.fn(`AWS.Account.${options.capability}`)(function* (request) {
            return yield* op((request ?? {}));
        });
    });
});
//# sourceMappingURL=BindingHttp.js.map