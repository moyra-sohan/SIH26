import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import { isBindingHost } from "../Lambda/Function.js";
/**
 * Shared scaffolding for Amazon DevOps Guru HTTP bindings.
 *
 * NOT exported from `index.ts` — every `{Op}Http.ts` in this service is a
 * thin `Layer.effect(Cap, makeDevOpsGuruAccountHttpBinding({ … }))` over the
 * builder below. Everything except the operation and the IAM action is
 * boilerplate.
 *
 * All DevOps Guru actions are account-level: the service does not support
 * resource-level IAM permissions (insights, anomalies, and health summaries
 * are account/region-scoped API objects, not ARN-addressable resources), so
 * the deploy-time half always grants the action on `*`.
 */
/**
 * Build the impl Effect for an account-level DevOps Guru operation. The
 * runtime callable passes the caller's request through unchanged; the
 * deploy-time half grants `actions` on `*`.
 */
export const makeDevOpsGuruAccountHttpBinding = (options) => Effect.gen(function* () {
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