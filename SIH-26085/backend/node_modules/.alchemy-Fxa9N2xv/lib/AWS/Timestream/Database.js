import * as TSW from "@distilled.cloud/aws/timestream-write";
import * as Effect from "effect/Effect";
import * as EffectStream from "effect/Stream";
import { Unowned } from "../../AdoptPolicy.js";
import { isResolved } from "../../Diff.js";
import { createPhysicalName } from "../../PhysicalName.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
import { createInternalTags, diffTags, hasAlchemyTags, } from "../../Tags.js";
import { AWSEnvironment } from "../Environment.js";
import { withWriteEndpoint } from "./internal.js";
/**
 * An Amazon Timestream for LiveAnalytics database — the top-level container for
 * time-series {@link Table}s.
 *
 * `Database` owns the database's lifecycle and its mutable configuration: the
 * KMS key used for encryption at rest and its tags. A database name is
 * auto-generated from the app, stage, and logical ID unless you provide one.
 *
 * :::note
 * Timestream for LiveAnalytics is closed to new AWS customers. Accounts that
 * were not already onboarded receive `TimestreamNotOnboarded` (a specialized
 * `AccessDenied`) on every operation.
 * :::
 * ### Creating Databases
 * **Example:** Basic Database
 * ```typescript
 * import * as Timestream from "alchemy/AWS/Timestream";
 *
 * const database = yield* Timestream.Database("Metrics");
 * ```
 *
 * **Example:** Database with a Customer-Managed KMS Key
 * ```typescript
 * const database = yield* Timestream.Database("SecureMetrics", {
 *   kmsKeyId: "alias/my-timestream-key",
 *   tags: { Environment: "production" },
 * });
 * ```
 *
 * @resource
 */
export const Database = Resource("AWS.Timestream.Database");
const createDatabaseName = (id, props) => Effect.gen(function* () {
    if (props.databaseName) {
        return props.databaseName;
    }
    return yield* createPhysicalName({ id, maxLength: 256 });
});
const toTagRecord = (tags) => Object.fromEntries((tags ?? []).map((tag) => [tag.Key, tag.Value]));
const readDatabase = Effect.fn(function* (databaseName) {
    const response = yield* withWriteEndpoint(TSW.describeDatabase({ DatabaseName: databaseName })).pipe(Effect.catchTag("ResourceNotFoundException", () => Effect.succeed(undefined)));
    if (!response?.Database) {
        return undefined;
    }
    const database = response.Database;
    const tagsResponse = yield* withWriteEndpoint(TSW.listTagsForResource({ ResourceARN: database.Arn })).pipe(Effect.catchTag("ResourceNotFoundException", () => Effect.succeed(undefined)));
    if (!tagsResponse) {
        return undefined;
    }
    return {
        databaseName: database.DatabaseName,
        databaseArn: database.Arn,
        kmsKeyId: database.KmsKeyId,
        tableCount: database.TableCount,
        tags: toTagRecord(tagsResponse.Tags),
    };
});
export const DatabaseProvider = () => Provider.effect(Database, Effect.gen(function* () {
    return {
        stables: ["databaseName", "databaseArn"],
        // Enumerate every Timestream database in the ambient account/region.
        // `listDatabases` is paginated; collect every page and hydrate each
        // into the exact `read` Attributes shape. A database that vanishes
        // between listing and hydration is dropped (typed NotFound handled in
        // `readDatabase`).
        list: () => Effect.gen(function* () {
            const names = yield* withWriteEndpoint(TSW.listDatabases.pages({}).pipe(EffectStream.runCollect)).pipe(Effect.map((chunk) => Array.from(chunk).flatMap((page) => (page.Databases ?? []).flatMap((db) => db.DatabaseName ? [db.DatabaseName] : []))));
            const hydrated = yield* Effect.forEach(names, (name) => readDatabase(name), { concurrency: 10 });
            return hydrated.filter((attrs) => attrs !== undefined);
        }),
        read: Effect.fn(function* ({ id, olds, output }) {
            const databaseName = output?.databaseName ?? (yield* createDatabaseName(id, olds ?? {}));
            const state = yield* readDatabase(databaseName);
            if (!state)
                return undefined;
            return (yield* hasAlchemyTags(id, state.tags))
                ? state
                : Unowned(state);
        }),
        diff: Effect.fn(function* ({ id, news = {}, olds = {} }) {
            if (!isResolved(news))
                return;
            const oldName = yield* createDatabaseName(id, olds);
            const newName = yield* createDatabaseName(id, news);
            if (oldName !== newName) {
                return { action: "replace" };
            }
        }),
        reconcile: Effect.fn(function* ({ id, news = {}, output, session }) {
            const { accountId, region } = yield* AWSEnvironment.current;
            const databaseName = output?.databaseName ?? (yield* createDatabaseName(id, news));
            const databaseArn = `arn:aws:timestream:${region}:${accountId}:database/${databaseName}`;
            const internalTags = yield* createInternalTags(id);
            const desiredTags = { ...internalTags, ...news.tags };
            // Observe — cloud state is authoritative; output is only a name cache.
            let state = yield* readDatabase(databaseName);
            // Ensure — create if missing. Tolerate a ConflictException as a race
            // with a peer reconciler and fall through to sync.
            if (state === undefined) {
                yield* withWriteEndpoint(TSW.createDatabase({
                    DatabaseName: databaseName,
                    KmsKeyId: news.kmsKeyId,
                    Tags: Object.entries(desiredTags).map(([Key, Value]) => ({
                        Key,
                        Value,
                    })),
                })).pipe(Effect.catchTag("ConflictException", () => Effect.void));
                yield* session.note(`Creating database ${databaseName}...`);
                state = yield* readDatabase(databaseName);
                if (state === undefined) {
                    return yield* Effect.fail(new Error(`failed to read created database ${databaseName}`));
                }
            }
            // Sync KMS key — only when the user pinned one and it drifted.
            if (news.kmsKeyId !== undefined && state.kmsKeyId !== news.kmsKeyId) {
                yield* withWriteEndpoint(TSW.updateDatabase({
                    DatabaseName: databaseName,
                    KmsKeyId: news.kmsKeyId,
                }));
                yield* session.note(`Updated KMS key for ${databaseName}`);
            }
            // Sync tags — diff against observed cloud tags.
            const { removed, upsert } = diffTags(state.tags, desiredTags);
            if (removed.length > 0) {
                yield* withWriteEndpoint(TSW.untagResource({
                    ResourceARN: databaseArn,
                    TagKeys: removed,
                }));
            }
            if (upsert.length > 0) {
                yield* withWriteEndpoint(TSW.tagResource({
                    ResourceARN: databaseArn,
                    Tags: upsert.map(({ Key, Value }) => ({ Key, Value })),
                }));
            }
            yield* session.note(databaseArn);
            const final = yield* readDatabase(databaseName);
            if (!final) {
                return yield* Effect.fail(new Error(`failed to read reconciled database ${databaseName}`));
            }
            return final;
        }),
        delete: Effect.fn(function* ({ output }) {
            yield* withWriteEndpoint(TSW.deleteDatabase({ DatabaseName: output.databaseName })).pipe(Effect.catchTag("ResourceNotFoundException", () => Effect.void));
        }),
    };
}));
//# sourceMappingURL=Database.js.map