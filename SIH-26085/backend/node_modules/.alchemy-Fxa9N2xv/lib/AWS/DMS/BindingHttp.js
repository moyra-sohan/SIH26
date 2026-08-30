import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import * as Output from "../../Output.js";
import { isBindingHost } from "../Lambda/Function.js";
/**
 * Shared HTTP scaffolding for the DMS runtime bindings.
 *
 * Every capability follows the same shape — resolve the distilled operation,
 * register an IAM policy statement on the binding host, and return a runtime
 * callable. The only variation is the operation, the IAM action(s), and the
 * identifier(s) injected from the bound resource: an {@link Endpoint}'s ARN,
 * a {@link ReplicationInstance}'s ARN, both (connection-shaped operations
 * like `TestConnection`/`RefreshSchemas`), or none (account-level describes).
 *
 * DMS `Describe*` actions do not support resource-level IAM permissions, so
 * describe-shaped capabilities grant on `*`; mutating capabilities
 * (`TestConnection`, `RefreshSchemas`, `RebootReplicationInstance`) grant on
 * the bound resource ARN(s).
 *
 * NOT exported from `index.ts`.
 */
/**
 * Build the impl Effect for an endpoint-scoped operation: the runtime
 * callable injects the bound {@link Endpoint}'s ARN as `EndpointArn`. DMS
 * describe actions are not resource-scoped in IAM, so the deploy-time half
 * grants `actions` on `*`.
 */
export const makeDmsEndpointScopedHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (endpoint) {
        const EndpointArn = yield* endpoint.endpointArn;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${endpoint}))`({
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
        return Effect.fn(`${options.tag}(${endpoint.LogicalId})`)(function* (request) {
            return yield* op({
                ...request,
                EndpointArn: yield* EndpointArn,
            });
        });
    });
});
/**
 * Build the impl Effect for a replication-instance-scoped operation: the
 * runtime callable injects the bound {@link ReplicationInstance}'s ARN as
 * `ReplicationInstanceArn`. Mutating actions (`RebootReplicationInstance`)
 * support resource-level IAM and grant on the instance ARN; describe actions
 * grant on `*` (set `iam: "wildcard"`).
 */
export const makeDmsInstanceScopedHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (instance) {
        const ReplicationInstanceArn = yield* instance.replicationInstanceArn;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${instance}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: options.iam === "resource"
                                ? [Output.interpolate `${instance.replicationInstanceArn}`]
                                : ["*"],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${instance.LogicalId})`)(function* (request) {
            return yield* op({
                ...request,
                ReplicationInstanceArn: yield* ReplicationInstanceArn,
            });
        });
    });
});
/**
 * Build the impl Effect for a connection-shaped operation that targets a
 * (replication instance, endpoint) pair — `TestConnection` and
 * `RefreshSchemas`. Both ARNs are injected from the bound resources and the
 * deploy-time half grants `actions` on both ARNs (these actions support
 * resource-level IAM on both resource types).
 */
export const makeDmsConnectionScopedHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (instance, endpoint) {
        const ReplicationInstanceArn = yield* instance.replicationInstanceArn;
        const EndpointArn = yield* endpoint.endpointArn;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${instance}, ${endpoint}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: [
                                Output.interpolate `${instance.replicationInstanceArn}`,
                                Output.interpolate `${endpoint.endpointArn}`,
                            ],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${instance.LogicalId}, ${endpoint.LogicalId})`)(function* (request) {
            return yield* op({
                ...request,
                ReplicationInstanceArn: yield* ReplicationInstanceArn,
                EndpointArn: yield* EndpointArn,
            });
        });
    });
});
/**
 * Build the impl Effect for an account-level operation (no target resource).
 * The deploy-time half grants `actions` on `*`.
 */
export const makeDmsAccountHttpBinding = (options) => Effect.gen(function* () {
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