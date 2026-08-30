import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import * as Output from "../../Output.js";
import { isBindingHost } from "../Lambda/Function.js";
/**
 * Shared scaffolding for Amazon DataZone HTTP bindings.
 *
 * NOT exported from `index.ts` — every thin `{Op}Http.ts` in this service is
 * a `Layer.effect(Cap, make…HttpBinding({ … }))` over one of the two builders
 * below. Everything except the operation and the IAM action list is
 * boilerplate: DataZone authorizes every action on the domain resource, so
 * the deploy-time half always grants `actions` on the bound domain's ARN.
 */
/**
 * Build the impl Effect for a domain-scoped DataZone operation: the runtime
 * callable injects the bound {@link Domain}'s id as `domainIdentifier` into
 * every request, and the deploy-time half grants `actions` on the domain ARN.
 */
export const makeDataZoneDomainHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (domain) {
        const DomainId = yield* domain.domainId;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${domain}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: [domain.domainArn],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${domain.LogicalId})`)(function* (request) {
            const domainIdentifier = yield* DomainId;
            return yield* op({ ...request, domainIdentifier });
        });
    });
});
/**
 * Build the impl Effect for an environment-scoped DataZone operation: the
 * runtime callable injects the bound {@link Environment}'s domain id and
 * environment id, and the deploy-time half grants `actions` on the parent
 * domain's ARN (DataZone authorizes every action on the domain resource).
 */
export const makeDataZoneEnvironmentHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (environment) {
        const DomainId = yield* environment.domainId;
        const EnvironmentId = yield* environment.environmentId;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${environment}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: [
                                Output.interpolate `arn:aws:datazone:*:*:domain/${environment.domainId}`,
                            ],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${environment.LogicalId})`)(function* (request) {
            return yield* op({
                ...request,
                domainIdentifier: yield* DomainId,
                environmentIdentifier: yield* EnvironmentId,
            });
        });
    });
});
//# sourceMappingURL=BindingHttp.js.map