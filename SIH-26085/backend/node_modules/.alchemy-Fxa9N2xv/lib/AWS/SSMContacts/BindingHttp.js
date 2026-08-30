/**
 * Shared scaffolding for the Incident Manager Contacts (SSM Contacts) HTTP
 * bindings.
 *
 * NOT exported from `index.ts` — every thin `{Op}Http.ts` in this service is
 * a `Layer.effect(Cap, make…HttpBinding({ … }))` over one of the builders
 * below. Everything except the operation and the IAM action list is
 * boilerplate:
 *
 * - Contact-scoped operations (`ssm-contacts:StartEngagement`,
 *   `ssm-contacts:ListPagesByContact`) inject the bound {@link Contact}'s
 *   ARN as the request's `ContactId` and are granted on the contact ARN.
 * - Channel-scoped operations (`ssm-contacts:ActivateContactChannel`, …)
 *   inject the bound {@link ContactChannel}'s ARN as `ContactChannelId` and
 *   are granted on the channel ARN.
 * - Rotation-scoped operations (`ssm-contacts:ListRotationShifts`, rotation
 *   overrides) inject the bound {@link Rotation}'s ARN as `RotationId` and
 *   are granted on the rotation ARN.
 * - Account-level operations (engagement / page reads and controls) take
 *   the caller's request as-is and are granted on `*` — engagement and page
 *   ARNs are minted at runtime and cannot be scoped statically.
 */
import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import { isBindingHost } from "../Lambda/Function.js";
/**
 * Build the impl Effect for an SSM Contacts operation scoped to a
 * {@link Contact}: the deploy-time half grants `actions` on the bound
 * contact's ARN, and the runtime half injects the contact's ARN as the
 * request's `ContactId` field.
 */
export const makeContactHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (contact) {
        const ContactArn = yield* contact.contactArn;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${contact}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: [contact.contactArn],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${contact.LogicalId})`)(function* (request) {
            return yield* op({
                ...request,
                ContactId: yield* ContactArn,
            });
        });
    });
});
/**
 * Build the impl Effect for an SSM Contacts operation scoped to a
 * {@link ContactChannel}: the deploy-time half grants `actions` on the bound
 * channel's ARN, and the runtime half injects the channel's ARN as the
 * request's `ContactChannelId` field.
 */
export const makeContactChannelHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (channel) {
        const ChannelArn = yield* channel.contactChannelArn;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${channel}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: [channel.contactChannelArn],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${channel.LogicalId})`)(function* (request) {
            return yield* op({
                ...request,
                ContactChannelId: yield* ChannelArn,
            });
        });
    });
});
/**
 * Build the impl Effect for an SSM Contacts operation scoped to a
 * {@link Rotation}: the deploy-time half grants `actions` on the bound
 * rotation's ARN, and the runtime half injects the rotation's ARN as the
 * request's `RotationId` field.
 */
export const makeRotationHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (rotation) {
        const RotationArn = yield* rotation.rotationArn;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${rotation}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: [rotation.rotationArn],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${rotation.LogicalId})`)(function* (request) {
            return yield* op({
                ...request,
                RotationId: yield* RotationArn,
            });
        });
    });
});
/**
 * Build the impl Effect for an account-level SSM Contacts operation
 * (engagement and page reads/controls). The deploy-time half grants
 * `actions` on `*` — engagement and page ARNs embed runtime-generated ids
 * and cannot be scoped to a deployed resource.
 */
export const makeAccountHttpBinding = (options) => Effect.gen(function* () {
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