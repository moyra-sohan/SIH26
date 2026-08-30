import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import { isBindingHost } from "../Lambda/Function.js";
/**
 * Shared scaffolding for AWS SNS HTTP bindings.
 *
 * NOT exported from `index.ts` — every near-identical `{Op}Http.ts` in this
 * service is a thin `Layer.effect(Cap, make…HttpBinding({ … }))` over one of
 * the builders below. Everything except the operation, the IAM action list,
 * and the injected identifier is boilerplate. Genuinely-different bindings
 * (the batched `TopicSink`) stay bespoke.
 */
/**
 * Build the impl Effect for an account-level operation (`ListTopics`,
 * `ListSubscriptions`, the SMS/sandbox APIs): the runtime callable passes
 * the caller's request through unchanged and the deploy-time half grants
 * `actions` on `*` (these SNS actions do not support resource-level
 * permissions — only topic-scoped actions do).
 */
export const makeSnsAccountHttpBinding = (options) => Effect.gen(function* () {
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
/**
 * Build the impl Effect for a topic-scoped operation: the runtime callable
 * injects the bound {@link Topic}'s ARN under `key` (`TopicArn` for the
 * pub/sub and attribute APIs, `ResourceArn` for the tagging and
 * data-protection-policy APIs) and the deploy-time half grants `actions` on
 * the topic's ARN.
 */
export const makeSnsTopicHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (topic) {
        const TopicArn = yield* topic.topicArn;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${topic}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: [topic.topicArn],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${topic.LogicalId})`)(function* (request) {
            return yield* op({
                ...request,
                [options.key]: yield* TopicArn,
            });
        });
    });
});
/**
 * Build the impl Effect for a subscription-scoped operation: the runtime
 * callable injects the bound {@link Subscription}'s identity under `key`
 * (`SubscriptionArn` for the attribute APIs, `TopicArn` for
 * `ConfirmSubscription`) and the deploy-time half grants `actions` on the
 * subscription's parent topic ARN (SNS checks subscription actions against
 * the topic resource).
 */
export const makeSnsSubscriptionHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (subscription) {
        const identity = yield* options.key === "TopicArn"
            ? subscription.topicArn
            : subscription.subscriptionArn;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${subscription}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: [subscription.topicArn],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${subscription.LogicalId})`)(function* (request) {
            return yield* op({
                ...request,
                [options.key]: yield* identity,
            });
        });
    });
});
/**
 * Build the impl Effect for a platform-application-scoped mobile-push
 * operation whose request accepts `PlatformApplicationArn`
 * (`CreatePlatformEndpoint`, `ListEndpointsByPlatformApplication`): the
 * runtime callable injects the bound {@link PlatformApplication}'s ARN and
 * the deploy-time half grants `actions` on `*` (SNS mobile-push actions do
 * not support resource-level permissions).
 */
export const makeSnsPlatformHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (application) {
        const PlatformApplicationArn = yield* application.platformApplicationArn;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${application}))`({
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
        return Effect.fn(`${options.tag}(${application.LogicalId})`)(function* (request) {
            return yield* op({
                ...request,
                PlatformApplicationArn: yield* PlatformApplicationArn,
            });
        });
    });
});
/**
 * Build the impl Effect for an endpoint-scoped mobile-push operation
 * (`GetEndpointAttributes`, `SetEndpointAttributes`, `DeleteEndpoint`,
 * publish-to-endpoint): the caller's request already carries the endpoint
 * identity (`EndpointArn`/`TargetArn`) and is passed through unchanged; the
 * binding is still scoped to a {@link PlatformApplication} for IAM naming
 * and grants `actions` on `*` (SNS mobile-push actions do not support
 * resource-level permissions).
 */
export const makeSnsEndpointHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (application) {
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${application}))`({
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
        return Effect.fn(`${options.tag}(${application.LogicalId})`)(function* (request) {
            return yield* op(request);
        });
    });
});
//# sourceMappingURL=BindingHttp.js.map