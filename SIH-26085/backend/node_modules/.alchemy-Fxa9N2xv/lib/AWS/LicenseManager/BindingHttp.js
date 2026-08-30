import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import { isBindingHost } from "../Lambda/Function.js";
/**
 * Shared HTTP scaffolding for the AWS License Manager runtime bindings.
 *
 * NOT exported from `index.ts` — every `{Op}Http.ts` in this service is a
 * thin `Layer.effect(Cap, make…HttpBinding({ … }))` over one of the builders
 * below. Everything except the operation, the IAM action, and (for the
 * configuration-scoped builder) the injected ARN is boilerplate.
 *
 * Per the `license-manager` service authorization reference, only the
 * `license-configuration` resource type supports resource-level scoping;
 * every other action (the checkout data plane, license/grant reads, the
 * resource inventory) authorizes on `Resource: ["*"]`.
 */
/**
 * Build the impl Effect for an account-level License Manager operation (the
 * license checkout data plane, license/grant reads, resource inventory, and
 * license-specification operations — none of which are resource-scoped in
 * IAM).
 */
export const makeLicenseManagerHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* () {
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, AWS.LicenseManager.${options.capability}())`({
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
        return Effect.fn(`AWS.LicenseManager.${options.capability}`)(function* (request) {
            return yield* op((request ?? {}));
        });
    });
});
/**
 * Build the impl Effect for a License Manager operation scoped to one
 * {@link LicenseConfiguration}: the deploy-time half grants `iamActions` on
 * the bound configuration's ARN (the `license-configuration` resource type
 * supports resource-level authorization), and the runtime half injects the
 * configuration's ARN as the request's `LicenseConfigurationArn`.
 */
export const makeLicenseConfigurationHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (configuration) {
        // Output yields a DEFERRED effect — resolve again per invocation below.
        const ConfigurationArn = yield* configuration.licenseConfigurationArn;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, AWS.LicenseManager.${options.capability}(${configuration}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.iamActions],
                            Resource: [configuration.licenseConfigurationArn],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`AWS.LicenseManager.${options.capability}(${configuration.LogicalId})`)(function* (request) {
            return yield* op({
                ...request,
                LicenseConfigurationArn: yield* ConfigurationArn,
            });
        });
    });
});
//# sourceMappingURL=BindingHttp.js.map