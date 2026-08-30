import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import * as Output from "../../Output.js";
import { isBindingHost } from "../Lambda/Function.js";
/**
 * Shared scaffolding for the Route 53 runtime bindings.
 *
 * NOT exported from `index.ts` — every `{Op}Http.ts` in this service is a
 * thin `Layer.effect(Cap, makeRoute53…HttpBinding({ … }))` over one of the
 * three builders below. Everything except the operation, the IAM action
 * list, and (for scoped operations) the injected zone / health check id is
 * boilerplate.
 *
 * Route 53 ARNs are global and account-less:
 * `arn:aws:route53:::hostedzone/{Id}` / `arn:aws:route53:::healthcheck/{Id}`.
 */
/**
 * Build the impl Effect for a hosted-zone-scoped Route 53 operation: the
 * runtime callable injects the bound {@link HostedZone}'s id under
 * `requestKey` and the deploy-time half grants `actions` on the zone's ARN
 * (or `*` when the action does not support resource-level permissions).
 */
export const makeRoute53ZoneHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    const requestKey = options.requestKey ?? "HostedZoneId";
    return Effect.fn(function* (zone) {
        const zoneId = yield* zone.id;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${zone}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: options.wildcardIam
                                ? ["*"]
                                : [
                                    Output.interpolate `arn:aws:route53:::hostedzone/${zone.id}`,
                                ],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${zone.LogicalId})`)(function* (request) {
            return yield* op({
                ...request,
                [requestKey]: yield* zoneId,
            });
        });
    });
});
/**
 * Build the impl Effect for a health-check-scoped Route 53 operation: the
 * runtime callable injects the bound {@link HealthCheck}'s id as
 * `HealthCheckId` and the deploy-time half grants `actions` on the health
 * check's ARN.
 */
export const makeRoute53HealthCheckHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (healthCheck) {
        const healthCheckId = yield* healthCheck.id;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${healthCheck}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: [
                                Output.interpolate `arn:aws:route53:::healthcheck/${healthCheck.id}`,
                            ],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${healthCheck.LogicalId})`)(function* (request) {
            return yield* op({
                ...request,
                HealthCheckId: yield* healthCheckId,
            });
        });
    });
});
/**
 * Build the impl Effect for an account-level Route 53 operation (no resource
 * argument): the deploy-time half grants `actions` on `resources`
 * (default `*`).
 */
export const makeRoute53AccountHttpBinding = (options) => Effect.gen(function* () {
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
                            Resource: [...(options.resources ?? ["*"])],
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