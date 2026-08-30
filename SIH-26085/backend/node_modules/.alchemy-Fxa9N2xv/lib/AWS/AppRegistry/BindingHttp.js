import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import * as Output from "../../Output.js";
import { isBindingHost } from "../Lambda/Function.js";
/**
 * Shared scaffolding for AppRegistry HTTP bindings.
 *
 * NOT exported from `index.ts` — every `{Op}Http.ts` in this service is a
 * thin `Layer.effect(Cap, make…HttpBinding({ … }))` over one of the three
 * builders below. Everything except the operation, the IAM action list, and
 * the injected identifier is boilerplate.
 *
 * AppRegistry IAM actions live under the `servicecatalog:` service prefix.
 */
/**
 * Build the impl Effect for an application-scoped operation: the runtime
 * callable injects the bound {@link Application}'s ID as `application` and
 * the deploy-time half grants `actions` on the application ARN.
 */
export const makeApplicationScopedHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (application) {
        const ApplicationId = yield* application.applicationId;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${application}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: [Output.interpolate `${application.applicationArn}`],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${application.LogicalId})`)(function* (request) {
            return yield* op({
                ...request,
                application: yield* ApplicationId,
            });
        });
    });
});
/**
 * Build the impl Effect for an attribute-group-scoped operation: the runtime
 * callable injects the bound {@link AttributeGroup}'s ID as `attributeGroup`
 * and the deploy-time half grants `actions` on the attribute group ARN.
 */
export const makeAttributeGroupScopedHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (attributeGroup) {
        const AttributeGroupId = yield* attributeGroup.attributeGroupId;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${attributeGroup}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: [
                                Output.interpolate `${attributeGroup.attributeGroupArn}`,
                            ],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${attributeGroup.LogicalId})`)(function* (request) {
            return yield* op({
                ...request,
                attributeGroup: yield* AttributeGroupId,
            });
        });
    });
});
/**
 * Build the impl Effect for an account-level operation (no target resource).
 * The deploy-time half grants `actions` on `*`.
 */
export const makeAppRegistryAccountHttpBinding = (options) => Effect.gen(function* () {
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