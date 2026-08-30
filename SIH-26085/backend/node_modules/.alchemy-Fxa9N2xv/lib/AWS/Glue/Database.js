import * as glue from "@distilled.cloud/aws/glue";
import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";
import { Unowned } from "../../AdoptPolicy.js";
import { isResolved } from "../../Diff.js";
import { createPhysicalName } from "../../PhysicalName.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
import { createInternalTags, hasAlchemyTags } from "../../Tags.js";
import { AWSEnvironment } from "../Environment.js";
import { cleanMap, databaseArn, retryWhileConcurrentModification, } from "./internal.js";
/**
 * An AWS Glue Data Catalog database — the top-level container for Glue tables
 * that Athena, EMR, Redshift Spectrum, and Glue jobs query. Databases are free
 * and instant to create.
 * ### Creating Databases
 * **Example:** Basic Database
 * ```typescript
 * import * as AWS from "alchemy/AWS";
 *
 * const database = yield* AWS.Glue.Database("Analytics", {
 *   databaseName: "analytics",
 * });
 * ```
 *
 * **Example:** Database with a Default S3 Location
 * ```typescript
 * const database = yield* AWS.Glue.Database("Analytics", {
 *   databaseName: "analytics",
 *   description: "Curated analytics tables",
 *   locationUri: "s3://my-data-lake/analytics/",
 *   parameters: { classification: "parquet" },
 * });
 * ```
 *
 * @resource
 */
export const Database = Resource("AWS.Glue.Database");
export const DatabaseProvider = () => Provider.effect(Database, Effect.gen(function* () {
    const createName = Effect.fn(function* (id, props) {
        return (props.databaseName ??
            (yield* createPhysicalName({ id, maxLength: 255, lowercase: true })));
    });
    const observe = Effect.fn(function* (name, catalogId) {
        return yield* glue
            .getDatabase({ Name: name, CatalogId: catalogId })
            .pipe(Effect.map((r) => r.Database), Effect.catchTag("EntityNotFoundException", () => Effect.succeed(undefined)));
    });
    return Database.Provider.of({
        stables: ["databaseName", "databaseArn", "catalogId"],
        list: () => Effect.gen(function* () {
            const { accountId, region } = yield* AWSEnvironment.current;
            const pages = yield* glue.getDatabases
                .pages({})
                .pipe(Stream.runCollect);
            return Array.from(pages)
                .flatMap((page) => page.DatabaseList ?? [])
                .map((db) => ({
                databaseName: db.Name,
                databaseArn: databaseArn(region, db.CatalogId ?? accountId, db.Name),
                catalogId: db.CatalogId ?? accountId,
            }));
        }),
        read: Effect.fn(function* ({ id, olds, output }) {
            const { accountId, region } = yield* AWSEnvironment.current;
            const catalogId = output?.catalogId ?? olds?.catalogId ?? accountId;
            const name = output?.databaseName ?? (yield* createName(id, olds ?? {}));
            const db = yield* observe(name, catalogId);
            if (db === undefined)
                return undefined;
            const attrs = {
                databaseName: db.Name,
                databaseArn: databaseArn(region, db.CatalogId ?? catalogId, db.Name),
                catalogId: db.CatalogId ?? catalogId,
            };
            // Glue databases are not ARN-taggable — ownership markers live in
            // the database Parameters map.
            return (yield* hasAlchemyTags(id, cleanMap(db.Parameters)))
                ? attrs
                : Unowned(attrs);
        }),
        diff: Effect.fn(function* ({ id, news, olds }) {
            if (!isResolved(news))
                return undefined;
            const oldName = yield* createName(id, olds);
            const newName = yield* createName(id, news);
            if (oldName !== newName)
                return { action: "replace" };
            if ((olds.catalogId ?? undefined) !== (news.catalogId ?? undefined)) {
                return { action: "replace" };
            }
            // description / locationUri / parameters → update
        }),
        reconcile: Effect.fn(function* ({ id, news, output, session }) {
            const { accountId, region } = yield* AWSEnvironment.current;
            const catalogId = news.catalogId ?? output?.catalogId ?? accountId;
            const name = output?.databaseName ?? (yield* createName(id, news));
            const internalTags = yield* createInternalTags(id);
            const desiredParameters = { ...news.parameters, ...internalTags };
            const databaseInput = {
                Name: name,
                Description: news.description,
                LocationUri: news.locationUri,
                Parameters: desiredParameters,
            };
            // 1. OBSERVE
            let db = yield* observe(name, catalogId);
            // 2. ENSURE
            if (db === undefined) {
                yield* glue
                    .createDatabase({
                    CatalogId: catalogId,
                    DatabaseInput: databaseInput,
                })
                    .pipe(Effect.catchTag("AlreadyExistsException", () => Effect.void), retryWhileConcurrentModification);
                db = yield* observe(name, catalogId);
            }
            else {
                // 3. SYNC — UpdateDatabase replaces the full DatabaseInput.
                yield* glue
                    .updateDatabase({
                    CatalogId: catalogId,
                    Name: name,
                    DatabaseInput: databaseInput,
                })
                    .pipe(retryWhileConcurrentModification);
                db = yield* observe(name, catalogId);
            }
            yield* session.note(name);
            return {
                databaseName: name,
                databaseArn: databaseArn(region, db?.CatalogId ?? catalogId, name),
                catalogId: db?.CatalogId ?? catalogId,
            };
        }),
        delete: Effect.fn(function* ({ output }) {
            yield* glue
                .deleteDatabase({
                Name: output.databaseName,
                CatalogId: output.catalogId,
            })
                .pipe(retryWhileConcurrentModification, Effect.catchTag("EntityNotFoundException", () => Effect.void));
        }),
    });
}));
//# sourceMappingURL=Database.js.map