import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import { isBindingHost } from "../Lambda/Function.js";
/**
 * Shared scaffolding for AWS Elemental MediaLive HTTP bindings.
 *
 * NOT exported from `index.ts` — every thin `{Op}Http.ts` in this service
 * is a `Layer.effect(Cap, make…HttpBinding({ … }))` over one of the three
 * builders below. Everything except the operation and the IAM action list
 * is boilerplate: channel-scoped bindings inject the bound channel's
 * server-assigned id as the request's `ChannelId` and grant `actions` on
 * the channel ARN; input-scoped bindings do the same with `InputId` and
 * the input ARN; account-scoped bindings pass the request through and
 * grant `actions` on `*`.
 */
/**
 * Build the impl Effect for a MediaLive operation scoped to a
 * {@link Channel}: the deploy-time half grants `actions` on the bound
 * channel's ARN, and the runtime half injects the channel's id into every
 * request as `ChannelId`.
 */
export const makeMediaLiveChannelHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (channel) {
        const ChannelId = yield* channel.channelId;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${channel}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: [channel.channelArn],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${channel.LogicalId})`)(function* (request) {
            const channelId = yield* ChannelId;
            return yield* op({ ...request, ChannelId: channelId });
        });
    });
});
/**
 * Build the impl Effect for a MediaLive operation scoped to an
 * {@link Input}: the deploy-time half grants `actions` on the bound
 * input's ARN, and the runtime half injects the input's id into every
 * request as `InputId`.
 */
export const makeMediaLiveInputHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (input) {
        const InputId = yield* input.inputId;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${input}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: [input.inputArn],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${input.LogicalId})`)(function* (request) {
            const inputId = yield* InputId;
            return yield* op({ ...request, InputId: inputId });
        });
    });
});
/**
 * Build the impl Effect for an account-level MediaLive operation (e.g.
 * enumerating the account's channels or inputs). The deploy-time half
 * grants `actions` on `*` — these list operations are not scoped to a
 * single resource.
 */
export const makeMediaLiveAccountHttpBinding = (options) => Effect.gen(function* () {
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