import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import * as Output from "../../Output.js";
import { AWSEnvironment } from "../Environment.js";
import { isBindingHost } from "../Lambda/Function.js";
/**
 * Shared scaffolding for the EventBridge runtime bindings.
 *
 * NOT exported from `index.ts` — every single-operation `{Op}Http.ts` in
 * this service is a thin `Layer.effect(Cap, makeEventBridge…HttpBinding({ … }))`
 * over one of the three builders below. Everything except the operation, the
 * IAM action list, and the injected identifier(s) is boilerplate:
 *
 * - {@link makeEventBridgeAccountHttpBinding} — account-level operations
 *   (`ListEventBuses`, `TestEventPattern`, `ListRuleNamesByTarget`, replay
 *   reads). The runtime callable passes the caller's request through
 *   unchanged; the deploy-time half grants `actions` on `resources`
 *   (default `*` — most EventBridge list/test actions do not support
 *   resource-level permissions).
 * - {@link makeEventBridgeBusHttpBinding} — operations scoped to an optional
 *   bound {@link EventBus} (`DescribeEventBus`, `ListRules`). The runtime
 *   callable injects the bus name under `busNameKey` (omitted for the
 *   default bus); the deploy-time half grants `actions` on the bus ARN, or
 *   the account default bus ARN when no bus is bound.
 * - {@link makeEventBridgeRuleHttpBinding} — operations scoped to a bound
 *   {@link Rule} (`DescribeRule`, `ListTargetsByRule`, `EnableRule`,
 *   `DisableRule`). The runtime callable injects the rule name under
 *   `ruleNameKey` and the bus name under `EventBusName` (omitted for the
 *   default bus); the deploy-time half grants `actions` on the rule ARN.
 *
 * Genuinely-different bindings stay bespoke: `PutEvents` (per-entry bus-name
 * injection), `BusSink` (a batching sink over `PutEvents`), and
 * `StartReplay` (archive-scoped with a replay-wildcard grant).
 */
/**
 * Build the impl Effect for an account-level EventBridge operation. The
 * runtime callable passes the caller's request through unchanged; the
 * deploy-time half grants `actions` on `resources` (default `*`).
 */
export const makeEventBridgeAccountHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* () {
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                const { accountId, region } = yield* AWSEnvironment.current;
                yield* host.bind `Allow(${host}, ${options.tag}())`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: options.resources
                                ? [...options.resources({ accountId, region })]
                                : ["*"],
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
 * Build the impl Effect for an EventBridge operation scoped to an optional
 * bound {@link EventBus}. The runtime callable injects the bus name under
 * `busNameKey` (omitted for the default bus); the deploy-time half grants
 * `actions` on the bus ARN, or the account default bus ARN when no bus is
 * bound.
 */
export const makeEventBridgeBusHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (bus) {
        const EventBusName = bus ? yield* bus.eventBusName : undefined;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                const { accountId, region } = yield* AWSEnvironment.current;
                // Pass the ARN as an unresolved Output — binding data is resolved
                // by the engine before the host reconciles. Eagerly yielding here
                // (during plan) produces a deferred object that serializes into an
                // invalid IAM policy (MalformedPolicyDocumentException).
                const resource = bus
                    ? Output.interpolate `${bus.eventBusArn}`
                    : `arn:aws:events:${region}:${accountId}:event-bus/default`;
                yield* host.bind `Allow(${host}, ${options.tag}(${bus ?? "default"}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: options.resources
                                ? [...options.resources({ accountId, region })]
                                : [resource],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${bus?.LogicalId})`)(function* (request) {
            const eventBusName = EventBusName ? yield* EventBusName : undefined;
            const input = { ...request };
            if (eventBusName !== undefined && eventBusName !== "default") {
                input[options.busNameKey] = eventBusName;
            }
            return yield* op(input);
        });
    });
});
/**
 * Build the impl Effect for an EventBridge operation scoped to a bound
 * {@link Rule}. The runtime callable injects the rule name under
 * `ruleNameKey` and the rule's bus name under `EventBusName` (omitted for
 * the default bus); the deploy-time half grants `actions` on the rule ARN.
 */
export const makeEventBridgeRuleHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (rule) {
        const RuleName = yield* rule.ruleName;
        const EventBusName = yield* rule.eventBusName;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${rule}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: [rule.ruleArn],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${rule.LogicalId})`)(function* (request) {
            const ruleName = yield* RuleName;
            const eventBusName = yield* EventBusName;
            const input = { ...request };
            input[options.ruleNameKey] = ruleName;
            if (eventBusName !== "default") {
                input.EventBusName = eventBusName;
            }
            return yield* op(input);
        });
    });
});
//# sourceMappingURL=BindingHttp.js.map