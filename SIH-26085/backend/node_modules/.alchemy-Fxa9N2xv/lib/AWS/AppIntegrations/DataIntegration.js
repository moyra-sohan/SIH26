import * as appintegrations from "@distilled.cloud/aws/appintegrations";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";
import { Unowned } from "../../AdoptPolicy.js";
import { isResolved } from "../../Diff.js";
import { createPhysicalName } from "../../PhysicalName.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
import { createInternalTags, diffTags, hasAlchemyTags } from "../../Tags.js";
import { definedTags } from "./internal.js";
/**
 * An Amazon AppIntegrations data integration. Data integrations reference an
 * external data source (an S3 bucket, or a SaaS application through Amazon
 * AppFlow) so services like Amazon Q in Connect can ingest its content.
 *
 * The KMS key, source URI, schedule, file configuration, and object
 * configuration are immutable; changing any of them replaces the data
 * integration. Only the name and description can be updated in place.
 * ### Creating a Data Integration
 * **Example:** S3 Data Integration
 * ```typescript
 * import * as AppIntegrations from "alchemy/AWS/AppIntegrations";
 * import * as KMS from "alchemy/AWS/KMS";
 * import * as S3 from "alchemy/AWS/S3";
 *
 * const bucket = yield* S3.Bucket("Content");
 * const key = yield* KMS.Key("ContentKey");
 *
 * const integration = yield* AppIntegrations.DataIntegration("Content", {
 *   kmsKey: key.keyArn,
 *   sourceURI: Output.interpolate`s3://${bucket.bucketName}`,
 * });
 * ```
 *
 * **Example:** Scheduled SaaS Data Integration
 * ```typescript
 * const integration = yield* AppIntegrations.DataIntegration("Salesforce", {
 *   kmsKey: key.keyArn,
 *   sourceURI: "Salesforce://AppFlow/my-connector-profile",
 *   scheduleConfig: {
 *     firstExecutionFrom: "2024-01-01T00:00:00Z",
 *     object: "Account",
 *     scheduleExpression: "rate(1 hours)",
 *   },
 * });
 * ```
 *
 * @resource
 */
export const DataIntegration = Resource("AWS.AppIntegrations.DataIntegration");
/**
 * Raised when the AppIntegrations API returns a data integration without
 * the fields required to build the resource attributes.
 */
export class DataIntegrationIncomplete extends Data.TaggedError("DataIntegrationIncomplete") {
}
export const DataIntegrationProvider = () => Provider.effect(DataIntegration, Effect.gen(function* () {
    const createName = Effect.fn(function* (id, props) {
        return (props.name ?? (yield* createPhysicalName({ id, maxLength: 255 })));
    });
    /** Get a single data integration by ARN or ID; undefined if absent. */
    const observe = (arnOrId) => appintegrations
        .getDataIntegration({ Identifier: arnOrId })
        .pipe(Effect.catchTag("ResourceNotFoundException", () => Effect.succeed(undefined)));
    /** Find a data integration ARN by name via list enumeration. */
    const findByName = (name) => appintegrations.listDataIntegrations.items({}).pipe(Stream.filter((item) => item.Name === name), Stream.take(1), Stream.runCollect, Effect.map((chunk) => Array.from(chunk)[0]?.Arn));
    const toAttrs = Effect.fn(function* (live) {
        if (live.Arn === undefined ||
            live.Id === undefined ||
            live.Name === undefined ||
            live.KmsKey === undefined ||
            live.SourceURI === undefined) {
            return yield* new DataIntegrationIncomplete({
                message: `data integration '${live.Name}' is missing Arn, Id, Name, KmsKey, or SourceURI`,
            });
        }
        return {
            dataIntegrationId: live.Id,
            dataIntegrationArn: live.Arn,
            dataIntegrationName: live.Name,
            kmsKey: live.KmsKey,
            sourceURI: live.SourceURI,
        };
    });
    const toScheduleConfiguration = (config) => ({
        ScheduleExpression: config.scheduleExpression,
        ...(config.firstExecutionFrom !== undefined
            ? { FirstExecutionFrom: config.firstExecutionFrom }
            : {}),
        ...(config.object !== undefined ? { Object: config.object } : {}),
    });
    return DataIntegration.Provider.of({
        stables: [
            "dataIntegrationId",
            "dataIntegrationArn",
            "kmsKey",
            "sourceURI",
        ],
        // The list API only returns Arn/Name/SourceURI summaries — hydrate
        // each into the full attributes shape, tolerating per-item NotFound
        // races.
        list: () => Effect.gen(function* () {
            const arns = yield* appintegrations.listDataIntegrations
                .items({})
                .pipe(Stream.runCollect, Effect.map((chunk) => Array.from(chunk).flatMap((item) => item.Arn !== undefined ? [item.Arn] : [])));
            const items = yield* Effect.forEach(arns, (arn) => observe(arn).pipe(Effect.flatMap((live) => live === undefined
                ? Effect.succeed(undefined)
                : toAttrs(live))), { concurrency: 10 });
            return items.filter((item) => item !== undefined);
        }),
        read: Effect.fn(function* ({ id, olds, output }) {
            let identifier = output?.dataIntegrationId;
            if (identifier === undefined) {
                const name = yield* createName(id, olds ?? {});
                identifier = yield* findByName(name);
            }
            if (identifier === undefined)
                return undefined;
            const live = yield* observe(identifier);
            if (live === undefined)
                return undefined;
            const attrs = yield* toAttrs(live);
            const tags = definedTags(live.Tags);
            return (yield* hasAlchemyTags(id, tags)) ? attrs : Unowned(attrs);
        }),
        diff: Effect.fn(function* ({ news, olds }) {
            if (!isResolved(news))
                return undefined;
            if (olds === undefined)
                return undefined;
            if (olds.kmsKey !== news.kmsKey ||
                olds.sourceURI !== news.sourceURI ||
                JSON.stringify(olds.scheduleConfig) !==
                    JSON.stringify(news.scheduleConfig) ||
                JSON.stringify(olds.fileConfiguration) !==
                    JSON.stringify(news.fileConfiguration) ||
                JSON.stringify(olds.objectConfiguration) !==
                    JSON.stringify(news.objectConfiguration)) {
                return { action: "replace" };
            }
            // fall through: default update path (name, description, tags)
        }),
        reconcile: Effect.fn(function* ({ id, news, output, session }) {
            const name = yield* createName(id, news);
            const internalTags = yield* createInternalTags(id);
            const desiredTags = { ...news.tags, ...internalTags };
            // 1. Observe — prefer the cached ID; fall back to enumerating by
            //    name so a lost-state re-run converges.
            let identifier = output?.dataIntegrationId;
            let live = identifier === undefined ? undefined : yield* observe(identifier);
            if (live === undefined) {
                identifier = yield* findByName(name);
                live =
                    identifier === undefined ? undefined : yield* observe(identifier);
            }
            // 2. Ensure — create if missing.
            if (live === undefined) {
                const created = yield* appintegrations.createDataIntegration({
                    Name: name,
                    Description: news.description,
                    KmsKey: news.kmsKey,
                    SourceURI: news.sourceURI,
                    ScheduleConfig: news.scheduleConfig
                        ? toScheduleConfiguration(news.scheduleConfig)
                        : undefined,
                    FileConfiguration: news.fileConfiguration
                        ? {
                            Folders: news.fileConfiguration.folders,
                            ...(news.fileConfiguration.filters
                                ? { Filters: news.fileConfiguration.filters }
                                : {}),
                        }
                        : undefined,
                    ObjectConfiguration: news.objectConfiguration,
                    Tags: desiredTags,
                });
                if (created.Arn === undefined) {
                    return yield* new DataIntegrationIncomplete({
                        message: `createDataIntegration for '${name}' returned no Arn`,
                    });
                }
                live = yield* appintegrations.getDataIntegration({
                    Identifier: created.Arn,
                });
            }
            const attrs = yield* toAttrs(live);
            // 3. Sync mutable aspects — only the name and description can be
            //    updated in place. The API cannot clear a description (min
            //    length 1), so only push a defined value that differs.
            const update = {};
            if (live.Name !== name) {
                update.Name = name;
            }
            if (news.description !== undefined &&
                news.description !== live.Description) {
                update.Description = news.description;
            }
            if (Object.keys(update).length > 0) {
                yield* appintegrations.updateDataIntegration({
                    Identifier: attrs.dataIntegrationId,
                    ...update,
                });
            }
            // 4. Sync tags — diff against OBSERVED cloud tags so adoption
            //    converges.
            const observedTags = definedTags(live.Tags);
            const { upsert, removed } = diffTags(observedTags, desiredTags);
            if (upsert.length > 0) {
                yield* appintegrations.tagResource({
                    resourceArn: attrs.dataIntegrationArn,
                    tags: Object.fromEntries(upsert.map((t) => [t.Key, t.Value])),
                });
            }
            if (removed.length > 0) {
                yield* appintegrations.untagResource({
                    resourceArn: attrs.dataIntegrationArn,
                    tagKeys: removed,
                });
            }
            yield* session.note(name);
            return { ...attrs, dataIntegrationName: name };
        }),
        delete: Effect.fn(function* ({ output }) {
            yield* appintegrations
                .deleteDataIntegration({
                DataIntegrationIdentifier: output.dataIntegrationId,
            })
                .pipe(Effect.catchTag("ResourceNotFoundException", () => Effect.void));
        }),
    });
}));
//# sourceMappingURL=DataIntegration.js.map