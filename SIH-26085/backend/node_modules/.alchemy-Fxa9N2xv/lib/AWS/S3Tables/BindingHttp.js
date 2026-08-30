import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import * as Output from "../../Output.js";
import { isBindingHost } from "../Lambda/Function.js";
/**
 * Shared scaffolding for the S3 Tables runtime bindings.
 *
 * NOT exported from `index.ts` — every `{Op}Http.ts` in this service is a
 * thin `Layer.effect(Cap, makeS3Tables…HttpBinding({ … }))` over one of the
 * two builders below. Everything except the operation, the IAM action list,
 * and the injected identifiers is boilerplate.
 */
/**
 * Build the impl Effect for a table-bucket-scoped S3 Tables operation: the
 * runtime callable injects the bound {@link TableBucket}'s ARN as
 * `tableBucketARN` and the deploy-time half grants `actions` on the bucket
 * ARN (and everything under it, for operations like `ListTables` whose IAM
 * resource is the namespace/table).
 */
export const makeS3TablesTableBucketHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (tableBucket) {
        const tableBucketARN = yield* tableBucket.tableBucketArn;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${tableBucket}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: [
                                Output.interpolate `${tableBucket.tableBucketArn}`,
                                // List operations authorize against the namespaces/tables
                                // under the bucket, e.g. `…:bucket/name/table/*`.
                                Output.interpolate `${tableBucket.tableBucketArn}/*`,
                            ],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${tableBucket.LogicalId})`)(function* (request) {
            return yield* op({
                ...request,
                tableBucketARN: yield* tableBucketARN,
            });
        });
    });
});
/**
 * Build the impl Effect for a table-scoped S3 Tables operation: the runtime
 * callable injects the bound {@link Table}'s `tableBucketARN`, `namespace`,
 * and `name`, and the deploy-time half grants `actions` on the table's ARN.
 */
export const makeS3TablesTableHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (table) {
        const tableBucketARN = yield* table.tableBucketArn;
        const namespace = yield* table.namespace;
        const name = yield* table.name;
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
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${table.LogicalId})`)(function* (request) {
            return yield* op({
                ...request,
                tableBucketARN: yield* tableBucketARN,
                namespace: yield* namespace,
                name: yield* name,
            });
        });
    });
});
//# sourceMappingURL=BindingHttp.js.map