import * as qbusiness from "@distilled.cloud/aws/qbusiness";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Schedule from "effect/Schedule";
import * as EffectStream from "effect/Stream";
import { Unowned } from "../../AdoptPolicy.js";
import { isResolved } from "../../Diff.js";
import { createPhysicalName } from "../../PhysicalName.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
import { createInternalTags, diffTags, hasAlchemyTags, } from "../../Tags.js";
/**
 * An Amazon Q Business data source — a connector that syncs documents from
 * a repository (S3 bucket, website, SharePoint, ...) into an index.
 *
 * ### Creating Data Sources
 * **Example:** S3 Data Source
 * ```typescript
 * import * as AWS from "alchemy/AWS";
 *
 * const source = yield* AWS.QBusiness.DataSource("Docs", {
 *   applicationId: app.applicationId,
 *   indexId: index.indexId,
 *   roleArn: dataSourceRole.roleArn,
 *   configuration: {
 *     type: "S3",
 *     syncMode: "FORCED_FULL_CRAWL",
 *     connectionConfiguration: {
 *       repositoryEndpointMetadata: { BucketName: bucket.bucketName },
 *     },
 *     repositoryConfigurations: {
 *       document: {
 *         fieldMappings: [{
 *           indexFieldName: "s3_document_id",
 *           indexFieldType: "STRING",
 *           dataSourceFieldName: "s3_document_id",
 *         }],
 *       },
 *     },
 *   },
 * });
 * ```
 *
 * **Example:** Scheduled Sync
 * ```typescript
 * const source = yield* AWS.QBusiness.DataSource("Docs", {
 *   applicationId: app.applicationId,
 *   indexId: index.indexId,
 *   roleArn: dataSourceRole.roleArn,
 *   syncSchedule: "cron(0 12 * * ? *)",
 *   configuration: { ... },
 * });
 * ```
 *
 * @resource
 */
export const DataSource = Resource("AWS.QBusiness.DataSource");
const createDisplayName = (id, props) => props.displayName
    ? Effect.succeed(props.displayName)
    : createPhysicalName({ id, maxLength: 100 });
const fetchTags = Effect.fn(function* (arn) {
    const response = yield* qbusiness
        .listTagsForResource({ resourceARN: arn })
        .pipe(Effect.catchTag("ResourceNotFoundException", () => Effect.succeed(undefined)));
    return Object.fromEntries((response?.tags ?? []).map((tag) => [tag.key, tag.value]));
});
const readDataSourceById = Effect.fn(function* (applicationId, indexId, dataSourceId) {
    const described = yield* qbusiness
        .getDataSource({ applicationId, indexId, dataSourceId })
        .pipe(Effect.catchTag("ResourceNotFoundException", () => Effect.succeed(undefined)));
    if (!described || described.status === "DELETING")
        return undefined;
    const arn = described.dataSourceArn;
    if (arn === undefined)
        return undefined;
    const state = {
        described,
        attrs: {
            dataSourceId: described.dataSourceId ?? dataSourceId,
            applicationId: described.applicationId ?? applicationId,
            indexId: described.indexId ?? indexId,
            dataSourceArn: arn,
            displayName: described.displayName ?? "",
            type: described.type,
            status: described.status,
            tags: yield* fetchTags(arn),
        },
    };
    return state;
});
const findDataSourceByName = Effect.fn(function* (applicationId, indexId, displayName) {
    const summaries = yield* qbusiness.listDataSources
        .pages({ applicationId, indexId })
        .pipe(EffectStream.runCollect, Effect.map((chunk) => Array.from(chunk).flatMap((page) => page.dataSources ?? [])), 
    // The parent application/index may itself be gone.
    Effect.catchTag("ResourceNotFoundException", () => Effect.succeed([])));
    const match = summaries.find((summary) => summary.displayName === displayName && summary.status !== "DELETING");
    if (!match?.dataSourceId)
        return undefined;
    return yield* readDataSourceById(applicationId, indexId, match.dataSourceId);
});
/**
 * A data source still transitioning toward the awaited status — retried by
 * {@link waitForDataSourceStatus}'s bounded schedule.
 */
class DataSourceNotReady extends Data.TaggedError("QBusinessDataSourceNotReady") {
}
/**
 * A data source whose asynchronous provisioning converged to the terminal
 * `FAILED` status.
 */
export class DataSourceProvisioningFailed extends Data.TaggedError("QBusinessDataSourceProvisioningFailed") {
}
// Explicitly-typed retry wrapper — an inline `Effect.retry` in provider
// lifecycle code leaks `Retry.Return`'s conditional type into declaration
// emit and widens the provider layer to `unknown` for every consumer of
// `AWS.providers()`.
const retryWhileNotReady = (self) => Effect.retry(self, {
    while: (e) => e._tag === "QBusinessDataSourceNotReady",
    // Data source provisioning is usually well under a minute; budget ~5 min.
    schedule: Schedule.max([Schedule.spaced("5 seconds"), Schedule.recurs(60)]),
});
// CreateDataSource validates the IAM role up front; a freshly-created role
// may not have propagated yet and surfaces as ValidationException. Bounded
// retry through the propagation window (~60s).
const retryThroughIamPropagation = (self) => Effect.retry(self, {
    while: (e) => e._tag === "ValidationException",
    schedule: Schedule.max([Schedule.spaced("5 seconds"), Schedule.recurs(12)]),
});
const waitForDataSourceStatus = (applicationId, indexId, dataSourceId, target) => retryWhileNotReady(Effect.gen(function* () {
    const described = yield* qbusiness
        .getDataSource({ applicationId, indexId, dataSourceId })
        .pipe(Effect.catchTag("ResourceNotFoundException", () => Effect.succeed(undefined)));
    if (target === "DELETED") {
        if (described === undefined)
            return;
        return yield* Effect.fail(new DataSourceNotReady({ dataSourceId, status: described.status }));
    }
    if (described?.status === "ACTIVE")
        return;
    if (described?.status === "FAILED") {
        return yield* Effect.fail(new DataSourceProvisioningFailed({
            dataSourceId,
            message: described.error?.errorMessage,
        }));
    }
    return yield* Effect.fail(new DataSourceNotReady({ dataSourceId, status: described?.status }));
}));
export const DataSourceProvider = () => Provider.effect(DataSource, Effect.gen(function* () {
    return {
        stables: ["dataSourceId", "applicationId", "indexId", "dataSourceArn"],
        // Keyed by a parent application+index; cannot be enumerated
        // account-wide without iterating every application — treated as a
        // sub-resource per the factory list() convention.
        list: () => Effect.succeed([]),
        read: Effect.fn(function* ({ id, olds, output }) {
            const applicationId = output?.applicationId ?? olds?.applicationId;
            const indexId = output?.indexId ?? olds?.indexId;
            if (applicationId === undefined || indexId === undefined) {
                return undefined;
            }
            const state = output?.dataSourceId
                ? yield* readDataSourceById(applicationId, indexId, output.dataSourceId)
                : yield* findDataSourceByName(applicationId, indexId, yield* createDisplayName(id, olds ?? {}));
            if (!state)
                return undefined;
            return (yield* hasAlchemyTags(id, state.attrs.tags))
                ? state.attrs
                : Unowned(state.attrs);
        }),
        diff: Effect.fn(function* ({ news, olds }) {
            if (!isResolved(news))
                return;
            if (olds === undefined)
                return;
            // The parent application and index are fixed at creation.
            if (olds.applicationId !== news.applicationId ||
                olds.indexId !== news.indexId) {
                return { action: "replace" };
            }
        }),
        reconcile: Effect.fn(function* ({ id, news, output, session }) {
            if (!news) {
                return yield* Effect.fail(new Error("QBusiness DataSource requires props"));
            }
            const applicationId = news.applicationId;
            const indexId = news.indexId;
            const displayName = yield* createDisplayName(id, news);
            const internalTags = yield* createInternalTags(id);
            const desiredTags = { ...internalTags, ...news.tags };
            // Observe — prefer the cached id; fall back to a name lookup so a
            // create whose state failed to persist is adopted, not duplicated.
            let state = output?.dataSourceId
                ? yield* readDataSourceById(applicationId, indexId, output.dataSourceId)
                : yield* findDataSourceByName(applicationId, indexId, displayName);
            // Ensure — create if missing, then wait for ACTIVE.
            if (state === undefined) {
                const created = yield* retryThroughIamPropagation(qbusiness.createDataSource({
                    applicationId,
                    indexId,
                    displayName,
                    configuration: news.configuration,
                    vpcConfiguration: news.vpcConfiguration,
                    description: news.description,
                    syncSchedule: news.syncSchedule,
                    roleArn: news.roleArn,
                    documentEnrichmentConfiguration: news.documentEnrichmentConfiguration,
                    mediaExtractionConfiguration: news.mediaExtractionConfiguration,
                    tags: Object.entries(desiredTags).map(([key, value]) => ({
                        key,
                        value,
                    })),
                }));
                if (!created.dataSourceId) {
                    return yield* Effect.fail(new Error(`CreateDataSource for '${displayName}' returned no dataSourceId`));
                }
                yield* session.note(`Creating data source ${displayName} (${created.dataSourceId})...`);
                yield* waitForDataSourceStatus(applicationId, indexId, created.dataSourceId, "ACTIVE");
                state = yield* readDataSourceById(applicationId, indexId, created.dataSourceId);
                if (state === undefined) {
                    return yield* Effect.fail(new Error(`failed to read created data source ${displayName}`));
                }
            }
            // Sync mutable settings via UpdateDataSource — only when drifted.
            const described = state.described;
            const needsUpdate = displayName !== described.displayName ||
                (news.description ?? "") !== (described.description ?? "") ||
                (news.syncSchedule ?? "") !== (described.syncSchedule ?? "") ||
                (news.roleArn !== undefined &&
                    news.roleArn !== described.roleArn) ||
                news.configuration !== undefined ||
                news.vpcConfiguration !== undefined ||
                news.documentEnrichmentConfiguration !== undefined ||
                news.mediaExtractionConfiguration !== undefined;
            if (needsUpdate) {
                yield* qbusiness.updateDataSource({
                    applicationId,
                    indexId,
                    dataSourceId: state.attrs.dataSourceId,
                    displayName,
                    configuration: news.configuration,
                    vpcConfiguration: news.vpcConfiguration,
                    description: news.description,
                    syncSchedule: news.syncSchedule,
                    roleArn: news.roleArn,
                    documentEnrichmentConfiguration: news.documentEnrichmentConfiguration,
                    mediaExtractionConfiguration: news.mediaExtractionConfiguration,
                });
                yield* waitForDataSourceStatus(applicationId, indexId, state.attrs.dataSourceId, "ACTIVE");
                yield* session.note(`Updated data source ${displayName}`);
            }
            // Sync tags — diff against observed cloud tags.
            const { removed, upsert } = diffTags(state.attrs.tags, desiredTags);
            if (removed.length > 0) {
                yield* qbusiness.untagResource({
                    resourceARN: state.attrs.dataSourceArn,
                    tagKeys: removed,
                });
            }
            if (upsert.length > 0) {
                yield* qbusiness.tagResource({
                    resourceARN: state.attrs.dataSourceArn,
                    tags: upsert.map(({ Key, Value }) => ({
                        key: Key,
                        value: Value,
                    })),
                });
            }
            yield* session.note(state.attrs.dataSourceArn);
            const final = yield* readDataSourceById(applicationId, indexId, state.attrs.dataSourceId);
            if (!final) {
                return yield* Effect.fail(new Error(`failed to read reconciled data source ${displayName}`));
            }
            return final.attrs;
        }),
        delete: Effect.fn(function* ({ output }) {
            yield* qbusiness
                .deleteDataSource({
                applicationId: output.applicationId,
                indexId: output.indexId,
                dataSourceId: output.dataSourceId,
            })
                .pipe(Effect.catchTag("ResourceNotFoundException", () => Effect.void));
            yield* waitForDataSourceStatus(output.applicationId, output.indexId, output.dataSourceId, "DELETED");
        }),
    };
}));
//# sourceMappingURL=DataSource.js.map