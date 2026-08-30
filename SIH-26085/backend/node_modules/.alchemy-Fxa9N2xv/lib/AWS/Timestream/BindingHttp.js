import * as TSQ from "@distilled.cloud/aws/timestream-query";
import * as TSW from "@distilled.cloud/aws/timestream-write";
import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import * as Output from "../../Output.js";
import { isBindingHost } from "../Lambda/Function.js";
import { discover, withEndpoint } from "./internal.js";
/**
 * Shared scaffolding for Amazon Timestream HTTP bindings.
 *
 * NOT exported from `index.ts` — every thin `{Op}Http.ts` in this service is
 * a `Layer.effect(Cap, make…HttpBinding({ … }))` over one of the builders
 * below. Everything except the operation, the IAM action list, and the
 * injected identifier is boilerplate.
 *
 * Timestream's wrinkle: every request must be routed through the
 * cell-specific endpoint returned by `DescribeEndpoints` (see
 * {@link discover}), so each builder captures its service's
 * `describeEndpoints` at layer init (yield-first, so the runtime callable is
 * requirement-free) and every binding additionally grants the unscoped
 * `timestream:DescribeEndpoints` the discovery flow needs.
 */
const describeEndpointsStatement = {
    Effect: "Allow",
    // Endpoint discovery is required and is not scoped to a resource.
    Action: ["timestream:DescribeEndpoints"],
    Resource: ["*"],
};
/**
 * Build the impl Effect for a table-scoped `timestream-write` operation. The
 * deploy-time half grants `actions` on the bound {@link Table}'s ARN (plus
 * its owning database's ARN when `grantDatabaseArn` is set — batch load
 * authorizes against both); the runtime callable shapes the caller's request
 * via `toRequest`, injecting the table's physical names.
 */
export const makeWriteTableHttpBinding = (options) => Effect.gen(function* () {
    // Yield-first captures the operations' services (Credentials/Region/
    // HttpClient) at layer init so the runtime callable is requirement-free.
    const op = yield* options.operation;
    const describeEndpoints = yield* TSW.describeEndpoints;
    const withWriteEndpoint = withEndpoint(discover("write", describeEndpoints({})));
    return Effect.fn(function* (table) {
        const DatabaseName = yield* table.databaseName;
        const TableName = yield* table.tableName;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${table}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: options.grantDatabaseArn
                                ? [
                                    Output.interpolate `${table.tableArn}`,
                                    // The owning database's ARN is the table ARN minus its
                                    // `/table/{name}` suffix.
                                    table.tableArn.pipe(Output.map((arn) => arn.replace(/\/table\/[^/]*$/, ""))),
                                ]
                                : [Output.interpolate `${table.tableArn}`],
                        },
                        describeEndpointsStatement,
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${table.LogicalId})`)(function* (request) {
            return yield* withWriteEndpoint(op(options.toRequest(request, {
                DatabaseName: yield* DatabaseName,
                TableName: yield* TableName,
            })));
        });
    });
});
/**
 * Build the impl Effect for a table-scoped `timestream-query` operation
 * (`Query`, `PrepareQuery`). Timestream authorizes query actions against the
 * tables the SQL references, so the deploy-time half grants `actions` on the
 * bound {@link Table}'s ARN; the request passes through as-is (the SQL
 * references the database and table by name).
 */
export const makeQueryTableHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    const describeEndpoints = yield* TSQ.describeEndpoints;
    const withQueryEndpoint = withEndpoint(discover("query", describeEndpoints({})));
    return Effect.fn(function* (table) {
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${table}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: [Output.interpolate `${table.tableArn}`],
                        },
                        describeEndpointsStatement,
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${table.LogicalId})`)(function* (request) {
            return yield* withQueryEndpoint(op(request));
        });
    });
});
/**
 * Build the impl Effect for an account-level `timestream-write` operation
 * (batch-load task reads/resume — authorized against `*`, keyed by TaskId in
 * the request). Invoked with no resource argument; the request passes
 * through as-is.
 */
export const makeWriteAccountHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    const describeEndpoints = yield* TSW.describeEndpoints;
    const withWriteEndpoint = withEndpoint(discover("write", describeEndpoints({})));
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
                        describeEndpointsStatement,
                    ],
                });
            }
        }
        return Effect.fn(options.tag)(function* (request) {
            return yield* withWriteEndpoint(op(request));
        });
    });
});
/**
 * Build the impl Effect for an account-level `timestream-query` operation
 * (`CancelQuery` — authorized against `*`, keyed by QueryId in the request).
 * Invoked with no resource argument; the request passes through as-is.
 */
export const makeQueryAccountHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    const describeEndpoints = yield* TSQ.describeEndpoints;
    const withQueryEndpoint = withEndpoint(discover("query", describeEndpoints({})));
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
                        describeEndpointsStatement,
                    ],
                });
            }
        }
        return Effect.fn(options.tag)(function* (request) {
            return yield* withQueryEndpoint(op(request));
        });
    });
});
//# sourceMappingURL=BindingHttp.js.map