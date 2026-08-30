import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import * as Output from "../../Output.js";
import { isBindingHost } from "../Lambda/Function.js";
/**
 * Shared scaffolding for AWS Glue HTTP bindings.
 *
 * NOT exported from `index.ts` — every thin `{Op}Http.ts` in this service is
 * a `Layer.effect(Cap, make…HttpBinding({ … }))` over one of the builders
 * below. Everything except the operation, the identifier injection, and the
 * IAM action list is boilerplate.
 *
 * Glue's catalog IAM model authorizes table- and partition-addressed actions
 * against the *catalog*, *database*, and *table* ARNs together, so the
 * database/table builders grant on all the ARNs the action evaluates.
 */
/**
 * Build the impl Effect for a Glue operation addressed to a {@link Job} by
 * `JobName`: the runtime callable injects the bound job's name and the
 * deploy-time half grants `actions` on the job ARN — or on `*` when
 * `anyResource` is set, for the handful of Glue actions that do not support
 * resource-level permissions (verified live: `glue:GetJobBookmark` /
 * `glue:ResetJobBookmark` are evaluated with no resource — an ARN-scoped
 * Allow never matches and IAM implicit-denies).
 */
export const makeGlueJobHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (job) {
        // Outputs yield a DEFERRED effect — resolve again per invocation below.
        const JobName = yield* job.jobName;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${job}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: options.anyResource ? ["*"] : [job.jobArn],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${job.LogicalId})`)(function* (request) {
            return yield* op({ ...request, JobName: yield* JobName });
        });
    });
});
/**
 * Build the impl Effect for a Glue operation addressed to a {@link Crawler}
 * by `Name`: the runtime callable injects the bound crawler's name and the
 * deploy-time half grants `actions` on the crawler ARN.
 */
export const makeGlueCrawlerHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (crawler) {
        const Name = yield* crawler.crawlerName;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${crawler}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: [crawler.crawlerArn],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${crawler.LogicalId})`)(function* (request) {
            return yield* op({ ...request, Name: yield* Name });
        });
    });
});
/**
 * Build the impl Effect for a Glue Data Catalog operation addressed to a
 * {@link Database}: the runtime callable injects `DatabaseName` (+
 * `CatalogId`) and the deploy-time half grants `actions` on the catalog,
 * database, and contained-tables ARNs (Glue evaluates catalog actions
 * against all three).
 */
export const makeGlueDatabaseHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (database) {
        const DatabaseName = yield* database.databaseName;
        const CatalogId = yield* database.catalogId;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${database}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: [
                                // arn:…:database/{db} → arn:…:catalog
                                Output.map(database.databaseArn, (arn) => arn.replace(/:database\/.*$/, ":catalog")),
                                database.databaseArn,
                                // arn:…:database/{db} → arn:…:table/{db}/*
                                Output.map(database.databaseArn, (arn) => `${arn.replace(":database/", ":table/")}/*`),
                            ],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${database.LogicalId})`)(function* (request) {
            return yield* op({
                ...request,
                DatabaseName: yield* DatabaseName,
                CatalogId: yield* CatalogId,
            });
        });
    });
});
/**
 * Build the impl Effect for a Glue Data Catalog operation addressed to a
 * {@link Table}: the runtime callable injects `DatabaseName` + the table
 * name (+ `CatalogId`) and the deploy-time half grants `actions` on the
 * catalog, database, and table ARNs. Most table-addressed inputs carry the
 * table name as `TableName`; `GetTable` uses `Name` — pick with
 * `tableNameKey`.
 */
export const makeGlueTableHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (table) {
        const DatabaseName = yield* table.databaseName;
        const TableName = yield* table.tableName;
        const CatalogId = yield* table.catalogId;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${table}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: [
                                // arn:…:table/{db}/{tbl} → arn:…:catalog
                                Output.map(table.tableArn, (arn) => arn.replace(/:table\/.*$/, ":catalog")),
                                // arn:…:table/{db}/{tbl} → arn:…:database/{db}
                                Output.map(table.tableArn, (arn) => arn.replace(/:table\/([^/]+)\/.*$/, ":database/$1")),
                                table.tableArn,
                            ],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${table.LogicalId})`)(function* (request) {
            return yield* op({
                ...request,
                DatabaseName: yield* DatabaseName,
                [options.tableNameKey]: yield* TableName,
                CatalogId: yield* CatalogId,
            });
        });
    });
});
//# sourceMappingURL=BindingHttp.js.map