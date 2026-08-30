import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import { isBindingHost } from "../Lambda/Function.js";
/**
 * Shared scaffolding for Cloud Control HTTP bindings.
 *
 * NOT exported from `index.ts` — every `{Op}Http.ts` in this service is a
 * thin `Layer.effect(Cap, makeCloudControlHttpBinding({ … }))` over the
 * builder below. Everything except the operation and the IAM action is
 * boilerplate.
 *
 * All Cloud Control bindings are account-level: the `cloudformation:*Resource`
 * actions do not support resource-level scoping (the target is an arbitrary
 * CloudFormation type name), so the grant is on `*`. Because Cloud Control
 * invokes the resource type's handlers with the caller's credentials, callers
 * of handler-invoking operations may pass extra
 * {@link CloudControlBindingOptions.handlerPolicyStatements} that are attached
 * to the host alongside the Cloud Control grant.
 */
export const makeCloudControlHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (bindOptions) {
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
                        ...(bindOptions?.handlerPolicyStatements ?? []),
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