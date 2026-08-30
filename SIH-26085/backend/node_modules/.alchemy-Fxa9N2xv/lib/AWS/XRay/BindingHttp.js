import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import { isBindingHost } from "../Lambda/Function.js";
/**
 * Shared scaffolding for X-Ray HTTP bindings.
 *
 * NOT exported from `index.ts` — every single-operation `{Op}Http.ts` in
 * this service is a thin `Layer.effect(Cap, makeXRayHttpBinding({ … }))`
 * over the builder below. Everything except the operation and the IAM
 * action is boilerplate.
 *
 * X-Ray's trace, sampling, graph, and insight actions do not support
 * resource-level permissions, so the deploy-time half of every binding
 * grants its `actions` on `*` and the runtime callable passes the caller's
 * request through unchanged.
 */
export const makeXRayHttpBinding = (options) => Effect.gen(function* () {
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