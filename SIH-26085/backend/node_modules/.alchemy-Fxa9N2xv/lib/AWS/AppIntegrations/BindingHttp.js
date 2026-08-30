/**
 * Shared HTTP-binding scaffolding for the AppIntegrations service.
 * NOT exported from the service barrel — each `{Op}Http.ts` is a thin
 * one-call `Layer.effect(Cap, makeAppIntegrations*HttpBinding({ ... }))`.
 */
import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import { AWSEnvironment } from "../Environment.js";
import { isBindingHost } from "../Lambda/Function.js";
/**
 * Build the implementation effect for a resource-scoped AppIntegrations HTTP
 * binding: resolve the resource identifier at init, grant the IAM actions on
 * the host at deploy time, and inject the identifier into every request at
 * runtime under `requestKey`.
 */
export const makeAppIntegrationsHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (resource) {
        const Identifier = yield* options.identifier(resource);
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                const { accountId, region } = yield* AWSEnvironment.current;
                yield* host.bind `Allow(${host}, AWS.AppIntegrations.${options.name}(${resource}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: options.iamActions,
                            Resource: options.resources(resource, { region, accountId }),
                        },
                        ...(options.dependentActions?.length
                            ? [
                                {
                                    Effect: "Allow",
                                    Action: options.dependentActions,
                                    Resource: ["*"],
                                },
                            ]
                            : []),
                    ],
                });
            }
        }
        return Effect.fn(`AWS.AppIntegrations.${options.name}(${resource.LogicalId})`)(function* (request) {
            // The identifier key is re-added on top of the caller's request, so
            // the widened spread is exactly a WireReq.
            return yield* op({
                ...request,
                [options.requestKey]: yield* Identifier,
            });
        });
    });
});
/**
 * Build the implementation effect for an account-scoped AppIntegrations HTTP
 * binding (no resource argument): grant the IAM actions on `*` at deploy time
 * and forward requests to the operation at runtime.
 */
export const makeAppIntegrationsAccountHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* () {
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, AWS.AppIntegrations.${options.name}())`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: options.iamActions,
                            Resource: ["*"],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`AWS.AppIntegrations.${options.name}`)(function* (request) {
            // List requests are all-optional structs; an absent request is the
            // empty request.
            return yield* op((request ?? {}));
        });
    });
});
//# sourceMappingURL=BindingHttp.js.map