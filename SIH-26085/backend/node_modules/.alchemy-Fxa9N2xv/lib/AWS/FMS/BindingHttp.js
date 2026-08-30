import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import { isBindingHost } from "../Lambda/Function.js";
import { pinFms } from "./AdminAccount.js";
/**
 * Shared HTTP scaffolding for the AWS Firewall Manager runtime bindings.
 *
 * NOT exported from `index.ts` — every `{Op}Http.ts` in this service is a
 * thin `Layer.effect(Cap, makeFmsHttpBinding({ … }))` over the builder
 * below. Everything except the operation and the IAM action is boilerplate.
 *
 * All Firewall Manager operations are account-level: they act on the
 * policies, lists, resource sets, and compliance data of the calling
 * (administrator) account rather than on one bound Alchemy resource, so the
 * builder grants the IAM actions on `Resource: ["*"]` and the runtime
 * callable takes the raw request.
 *
 * Policy, list, resource-set, and compliance operations are regional (a
 * Firewall Manager policy lives in the region it was created in), so they
 * resolve against the ambient region. The organization-level administrator
 * management reads (`GetAdminScope`, `ListAdminAccountsForOrganization`,
 * `ListAdminsManagingAccount`) belong to the same global admin-account
 * family as the {@link AdminAccount} resource APIs, so they are pinned to
 * the us-east-1 endpoint via {@link pinFms}.
 */
export const makeFmsHttpBinding = (options) => Effect.gen(function* () {
    const op = options.pinToAdminRegion
        ? yield* pinFms(options.operation)
        : yield* options.operation;
    return Effect.fn(function* () {
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, AWS.FMS.${options.capability}())`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.iamActions],
                            Resource: ["*"],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`AWS.FMS.${options.capability}`)(function* (request) {
            // The admin-region pin must also be applied at the call site: the
            // yield-time snapshot is only a fallback — the calling fiber's
            // ambient Region (the host Function's own region) wins over it.
            const call = op((request ?? {}));
            return yield* options.pinToAdminRegion ? pinFms(call) : call;
        });
    });
});
//# sourceMappingURL=BindingHttp.js.map