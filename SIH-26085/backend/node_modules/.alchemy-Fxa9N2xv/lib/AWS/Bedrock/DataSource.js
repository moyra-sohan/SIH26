import * as bedrock from "@distilled.cloud/aws/bedrock-agent";
import * as Effect from "effect/Effect";
import * as Schedule from "effect/Schedule";
import { isResolved } from "../../Diff.js";
import { createPhysicalName } from "../../PhysicalName.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
/**
 * A data source attached to an Amazon Bedrock {@link KnowledgeBase} — the
 * origin of the documents the knowledge base embeds and indexes.
 *
 * The most common source is an S3 bucket. After the data source is created,
 * start an ingestion job (`bedrock-agent:StartIngestionJob`) to crawl the
 * source, chunk + embed the documents, and write them to the vector store.
 * Ingestion is not part of the desired-state lifecycle — trigger it whenever
 * the underlying documents change.
 *
 * ### Creating Data Sources
 * **Example:** S3 Data Source
 * ```typescript
 * import * as Bedrock from "alchemy/AWS/Bedrock";
 *
 * const source = yield* Bedrock.DataSource("docs-bucket", {
 *   knowledgeBaseId: kb.knowledgeBaseId,
 *   dataSourceConfiguration: {
 *     type: "S3",
 *     s3Configuration: { bucketArn: bucket.bucketArn },
 *   },
 *   dataDeletionPolicy: "DELETE",
 * });
 * ```
 *
 * @resource
 */
export const DataSource = Resource("AWS.Bedrock.DataSource");
/** Data-source status values indicating an in-flight transition. */
const DS_TRANSIENT = new Set(["CREATING", "UPDATING", "DELETING"]);
/**
 * A data source rejects deletion with a `ConflictException` while the parent
 * knowledge base is busy. Bounded retry (~60s), wrapped in an explicitly-typed
 * helper so the `Effect.retry` return type does not widen the provider layer's
 * requirement to `unknown` (see PATTERNS §7).
 */
const retryWhileConflict = (self) => Effect.retry(self, {
    while: (e) => e._tag === "ConflictException",
    schedule: Schedule.max([Schedule.fixed("3 seconds"), Schedule.recurs(20)]),
});
export const DataSourceProvider = () => Provider.effect(DataSource, Effect.gen(function* () {
    const createName = Effect.fn(function* (id, props) {
        return (props.name ?? (yield* createPhysicalName({ id, maxLength: 100 })));
    });
    const getDsOrUndefined = Effect.fn(function* (knowledgeBaseId, dataSourceId) {
        return yield* bedrock
            .getDataSource({ knowledgeBaseId, dataSourceId })
            .pipe(Effect.map((r) => r.dataSource), Effect.catchTag("ResourceNotFoundException", () => Effect.succeed(undefined)));
    });
    const waitForSettled = Effect.fn(function* (knowledgeBaseId, dataSourceId) {
        return yield* bedrock
            .getDataSource({ knowledgeBaseId, dataSourceId })
            .pipe(Effect.map((r) => r.dataSource), Effect.catchTag("ResourceNotFoundException", () => Effect.succeed(undefined)), Effect.repeat({
            schedule: Schedule.fixed("3 seconds"),
            until: (ds) => ds === undefined || !DS_TRANSIENT.has(ds.status),
            times: 40,
        }));
    });
    return DataSource.Provider.of({
        stables: ["knowledgeBaseId", "dataSourceId", "name"],
        // Data sources are scoped to a parent knowledge base — enumeration
        // requires the KB id, so this returns empty (the engine keys off state).
        list: () => Effect.succeed([]),
        read: Effect.fn(function* ({ olds, output }) {
            const knowledgeBaseId = output?.knowledgeBaseId ?? olds?.knowledgeBaseId;
            const dataSourceId = output?.dataSourceId;
            if (knowledgeBaseId === undefined || dataSourceId === undefined) {
                return undefined;
            }
            const ds = yield* getDsOrUndefined(knowledgeBaseId, dataSourceId);
            if (ds === undefined || ds.status === "DELETING")
                return undefined;
            return {
                knowledgeBaseId: ds.knowledgeBaseId,
                dataSourceId: ds.dataSourceId,
                name: ds.name,
            };
        }),
        diff: Effect.fn(function* ({ id, news, olds }) {
            if (!isResolved(news))
                return undefined;
            if ((olds?.knowledgeBaseId ?? undefined) !==
                (news?.knowledgeBaseId ?? undefined)) {
                return { action: "replace" };
            }
            const oldName = yield* createName(id, olds ?? {});
            const newName = yield* createName(id, news ?? {});
            if (oldName !== newName) {
                return { action: "replace" };
            }
            // description, config, and deletion policy converge via update.
        }),
        reconcile: Effect.fn(function* ({ id, news = {}, output, session, }) {
            const name = output?.name ?? (yield* createName(id, news));
            const knowledgeBaseId = news.knowledgeBaseId;
            // 1. OBSERVE
            let ds = output?.dataSourceId
                ? yield* getDsOrUndefined(knowledgeBaseId, output.dataSourceId)
                : undefined;
            if (ds === undefined) {
                // 2. ENSURE
                const created = yield* bedrock.createDataSource({
                    knowledgeBaseId,
                    name,
                    description: news.description,
                    dataSourceConfiguration: news.dataSourceConfiguration,
                    dataDeletionPolicy: news.dataDeletionPolicy,
                    vectorIngestionConfiguration: news.vectorIngestionConfiguration,
                });
                ds = created.dataSource;
                ds =
                    (yield* waitForSettled(knowledgeBaseId, ds.dataSourceId)) ?? ds;
            }
            else {
                // 3. SYNC
                ds =
                    (yield* waitForSettled(knowledgeBaseId, ds.dataSourceId)) ?? ds;
                const drifted = ds.description !== news.description ||
                    JSON.stringify(ds.dataSourceConfiguration) !==
                        JSON.stringify(news.dataSourceConfiguration) ||
                    (ds.dataDeletionPolicy ?? undefined) !==
                        (news.dataDeletionPolicy ?? undefined) ||
                    JSON.stringify(ds.vectorIngestionConfiguration ?? null) !==
                        JSON.stringify(news.vectorIngestionConfiguration ?? null);
                if (drifted) {
                    yield* bedrock.updateDataSource({
                        knowledgeBaseId,
                        dataSourceId: ds.dataSourceId,
                        name,
                        description: news.description,
                        dataSourceConfiguration: news.dataSourceConfiguration,
                        dataDeletionPolicy: news.dataDeletionPolicy,
                        vectorIngestionConfiguration: news.vectorIngestionConfiguration,
                    });
                    ds =
                        (yield* waitForSettled(knowledgeBaseId, ds.dataSourceId)) ?? ds;
                }
            }
            yield* session.note(ds.dataSourceId);
            return {
                knowledgeBaseId,
                dataSourceId: ds.dataSourceId,
                name,
            };
        }),
        delete: Effect.fn(function* ({ output }) {
            yield* retryWhileConflict(bedrock.deleteDataSource({
                knowledgeBaseId: output.knowledgeBaseId,
                dataSourceId: output.dataSourceId,
            })).pipe(Effect.catchTag("ResourceNotFoundException", () => Effect.void));
        }),
    });
}));
//# sourceMappingURL=DataSource.js.map