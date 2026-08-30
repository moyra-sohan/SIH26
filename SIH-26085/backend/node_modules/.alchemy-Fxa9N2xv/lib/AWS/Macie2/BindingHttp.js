import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import { isBindingHost } from "../Lambda/Function.js";
/**
 * Shared scaffolding for Amazon Macie HTTP bindings.
 *
 * NOT exported from `index.ts` — every thin `{Op}Http.ts` in this service is
 * a `Layer.effect(Cap, makeMacie2HttpBinding({ … }))` over the builder below.
 * Everything except the operation and the IAM action list is boilerplate.
 *
 * Macie is an account/region singleton service: every operation is implicitly
 * scoped to the caller's Macie session, so there is no identifier to inject —
 * the caller's request is passed through as-is. Macie2 IAM actions do not
 * support resource-level permissions (the session has no bindable ARN), so
 * the deploy-time half grants `actions` on `*`.
 */
export const makeMacie2HttpBinding = (options) => Effect.gen(function* () {
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