import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import { isBindingHost } from "../Lambda/Function.js";
import { sortByLogicalId } from "./common.js";
/**
 * Shared scaffolding for CloudWatch HTTP bindings.
 *
 * NOT exported from `index.ts` — every single-operation `{Op}Http.ts` in
 * this service is a thin `Layer.effect(Cap, make…HttpBinding({ … }))` over
 * one of the three builders below. Everything except the operation, the IAM
 * action, and the injected identifier(s) is boilerplate:
 *
 * - {@link makeCloudWatchAccountHttpBinding} — account-level operations
 *   (`PutMetricData`, `GetMetricData`, `List*`, account-wide `Describe*`).
 *   CloudWatch metric-data and account-wide describe/list actions do not
 *   support resource-level permissions, so the deploy-time half grants
 *   `actions` on `*`.
 * - {@link makeCloudWatchResourceHttpBinding} — operations scoped to one
 *   bound resource (`GetDashboard`, `SetAlarmState`, `GetMetricStream`, …).
 *   The runtime callable injects the resource's identifier under
 *   `requestKey`; the deploy-time half grants `actions` on the resource ARN.
 * - {@link makeCloudWatchResourceSetHttpBinding} — batch toggles over a
 *   variadic set of bound resources (`EnableAlarmActions`,
 *   `DisableInsightRules`, `StartMetricStreams`, …). The runtime callable
 *   takes no request and injects the sorted resource names under `namesKey`;
 *   the deploy-time half grants `action` on every resource ARN.
 *
 * Genuinely-different bindings stay bespoke: `DescribeAlarms` (computes
 * `AlarmTypes` from the bound alarm set and accepts a filter request) and
 * `MetricSink` (a batching sink over the `PutMetricData` capability).
 */
/**
 * Build the impl Effect for an account-level CloudWatch operation. The
 * runtime callable passes the caller's request through unchanged; the
 * deploy-time half grants `actions` on `*` (these CloudWatch actions do not
 * support resource-level permissions).
 */
export const makeCloudWatchAccountHttpBinding = (options) => Effect.gen(function* () {
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
 * Build the impl Effect for an operation scoped to a single bound CloudWatch
 * resource. The runtime callable injects the resolved `identifier` under
 * `requestKey`; the deploy-time half grants `actions` on `resourceArn`.
 */
export const makeCloudWatchResourceHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (resource) {
        const identifier = yield* options.identifier(resource);
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${resource}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: [options.resourceArn(resource)],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${resource.LogicalId})`)(function* (request) {
            const input = { ...request };
            input[options.requestKey] = yield* identifier;
            return yield* op(input);
        });
    });
});
/**
 * Build the impl Effect for a batch toggle over a variadic set of bound
 * CloudWatch resources. The runtime callable takes no request and injects
 * the resources' names (sorted by Logical ID for a deterministic binding
 * identity) under `namesKey`; the deploy-time half grants `action` on every
 * resource ARN.
 */
export const makeCloudWatchResourceSetHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (...resources) {
        const sorted = sortByLogicalId(resources);
        const names = yield* Effect.forEach(sorted, (resource) => options.name(resource).asEffect());
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${sorted}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [options.action],
                            Resource: sorted.map((resource) => options.arn(resource)),
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${sorted})`)(function* () {
            const input = {};
            input[options.namesKey] = yield* Effect.forEach(names, (name) => name);
            return yield* op(input);
        });
    });
});
//# sourceMappingURL=BindingHttp.js.map