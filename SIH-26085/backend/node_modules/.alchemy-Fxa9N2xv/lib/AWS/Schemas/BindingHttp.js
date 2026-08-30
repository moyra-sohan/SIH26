import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import * as Output from "../../Output.js";
import { isBindingHost } from "../Lambda/Function.js";
/**
 * Shared scaffolding for EventBridge Schemas HTTP bindings.
 *
 * NOT exported from `index.ts` — every thin `{Op}Http.ts` in this service is
 * a `Layer.effect(Cap, make…HttpBinding({ … }))` over one of the builders
 * below. Everything except the operation, the identifier resolver, and the
 * IAM action list is boilerplate.
 */
/**
 * Build the impl Effect for a Schemas operation scoped to a {@link Schema}:
 * the deploy-time half grants `actions` on the bound schema's ARN, and the
 * runtime half injects the schema's `RegistryName` + `SchemaName` into every
 * request.
 */
export const makeSchemasSchemaHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (schema) {
        const RegistryName = yield* schema.registryName;
        const SchemaName = yield* schema.schemaName;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${schema}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: [schema.schemaArn],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${schema.LogicalId})`)(function* (request) {
            return yield* op({
                ...request,
                RegistryName: yield* RegistryName,
                SchemaName: yield* SchemaName,
            });
        });
    });
});
/**
 * Build the impl Effect for a Schemas operation scoped to a {@link Registry}:
 * the deploy-time half grants `actions` on the registry ARN and on the
 * registry's schema-type ARN (`…:schema/{registryName}*` — the resource
 * `schemas:SearchSchemas` authorizes against), and the runtime half injects
 * the registry's `RegistryName` into every request.
 */
export const makeSchemasRegistryHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (registry) {
        const RegistryName = yield* registry.registryName;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${registry}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: [
                                registry.registryArn,
                                // Registry-scoped reads (e.g. SearchSchemas) authorize
                                // against the schema-type ARN keyed by the registry name.
                                Output.map(registry.registryArn, (arn) => `${arn.replace(":registry/", ":schema/")}*`),
                            ],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${registry.LogicalId})`)(function* (request) {
            return yield* op({
                ...request,
                RegistryName: yield* RegistryName,
            });
        });
    });
});
/**
 * Build the impl Effect for a Schemas operation scoped to a
 * {@link Discoverer}: the deploy-time half grants `actions` on the bound
 * discoverer's ARN (plus `ruleActions` on the discoverer's managed
 * EventBridge rule, which Start/StopDiscoverer flip behind the scenes), and
 * the runtime half injects the `DiscovererId` into every request.
 */
export const makeSchemasDiscovererHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (discoverer) {
        const DiscovererId = yield* discoverer.discovererId;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                // The managed rule is named `Schemas-{discovererId}` but TRUNCATED
                // to EventBridge's 64-char rule-name limit, so the grant wildcards
                // the name under the `Schemas-` prefix instead of interpolating
                // the full discoverer id.
                const toRuleArn = (busSegment) => Output.map(discoverer.discovererArn, (arn) => `${arn.replace(":schemas:", ":events:").split(":discoverer/")[0]}:rule/${busSegment}Schemas-*`);
                yield* host.bind `Allow(${host}, ${options.tag}(${discoverer}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: [discoverer.discovererArn],
                        },
                        ...(options.ruleActions !== undefined
                            ? [
                                {
                                    Effect: "Allow",
                                    Action: [...options.ruleActions],
                                    // The managed rule lives on the discovered bus
                                    // (`rule/{busName}/Schemas-{id}`) or, for the default
                                    // bus, directly under `rule/Schemas-{id}`.
                                    Resource: [toRuleArn("*/"), toRuleArn("")],
                                },
                            ]
                            : []),
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${discoverer.LogicalId})`)(function* (request) {
            return yield* op({
                ...request,
                DiscovererId: yield* DiscovererId,
            });
        });
    });
});
/**
 * Build the impl Effect for an account-level Schemas operation (e.g.
 * `GetDiscoveredSchema`, which infers a schema from sample events and is not
 * scoped to any registry or schema resource). The deploy-time half grants
 * `actions` on `*`.
 */
export const makeSchemasAccountHttpBinding = (options) => Effect.gen(function* () {
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