import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import { isBindingHost } from "../Lambda/Function.js";
/**
 * Shared scaffolding for the AWS IoT Managed Integrations HTTP bindings.
 *
 * NOT exported from `index.ts` — every thin `{Op}Http.ts` in this service is
 * a `Layer.effect(Cap, make…HttpBinding({ … }))` over one of the builders
 * below. Everything except the operation, the IAM action list, and (for the
 * thing-scoped builder) the injected identifier field is boilerplate.
 */
/**
 * Build the impl Effect for an operation scoped to one {@link ManagedThing}.
 * The deploy-time half grants `iamActions` on the bound thing's ARN; the
 * runtime half injects the thing's service-generated id into the request
 * under `key` (the API is split between `Identifier` and `ManagedThingId`
 * request fields).
 */
export const makeManagedThingHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (thing) {
        // Output yields a DEFERRED effect — resolve again per invocation below.
        const ManagedThingId = yield* thing.managedThingId;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, AWS.IoTManagedIntegrations.${options.capability}(${thing}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.iamActions],
                            Resource: [thing.managedThingArn],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`AWS.IoTManagedIntegrations.${options.capability}(${thing.LogicalId})`)(function* (request) {
            return yield* op({
                ...request,
                [options.key]: yield* ManagedThingId,
            });
        });
    });
});
/**
 * Build the impl Effect for an account-level IoT Managed Integrations
 * operation (device discovery, the schema catalog, the custom endpoint, and
 * connector events — per the `iotmanagedintegrations` service authorization
 * reference these authorize account-wide, so the grant is on
 * `Resource: ["*"]`).
 */
export const makeManagedIntegrationsHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* () {
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, AWS.IoTManagedIntegrations.${options.capability}())`({
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
        return Effect.fn(`AWS.IoTManagedIntegrations.${options.capability}`)(function* (request) {
            return yield* op((request ?? {}));
        });
    });
});
//# sourceMappingURL=BindingHttp.js.map