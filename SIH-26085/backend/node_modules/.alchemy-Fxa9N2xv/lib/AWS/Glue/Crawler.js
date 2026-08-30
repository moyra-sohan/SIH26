import * as glue from "@distilled.cloud/aws/glue";
import * as Effect from "effect/Effect";
import * as Schedule from "effect/Schedule";
import * as Stream from "effect/Stream";
import { Unowned } from "../../AdoptPolicy.js";
import { isResolved } from "../../Diff.js";
import { createPhysicalName } from "../../PhysicalName.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
import { createInternalTags, hasAlchemyTags } from "../../Tags.js";
import { AWSEnvironment } from "../Environment.js";
import { crawlerArn, fetchObservedTags, retryCrawlerDelete, retryWhileCrawlerTargetNotReady, retryWhileCrawlerRunning, retryWhileRoleNotAssumable, syncTags, } from "./internal.js";
/**
 * An AWS Glue crawler — connects to an S3 (or JDBC/DynamoDB/catalog) data
 * store, infers schemas, and populates the Glue Data Catalog with tables.
 * Runs are asynchronous: create the crawler, then invoke `startCrawler` (or
 * attach a schedule).
 * ### Creating Crawlers
 * **Example:** S3 Crawler
 * ```typescript
 * import * as AWS from "alchemy/AWS";
 *
 * const database = yield* AWS.Glue.Database("Analytics", {
 *   databaseName: "analytics",
 * });
 *
 * const crawler = yield* AWS.Glue.Crawler("EventsCrawler", {
 *   role: crawlerRole.roleArn,
 *   databaseName: database.databaseName,
 *   targets: {
 *     s3Targets: [{ path: "s3://my-data-lake/events/" }],
 *   },
 * });
 * ```
 *
 * **Example:** Scheduled Crawler with Schema Policy
 * ```typescript
 * const crawler = yield* AWS.Glue.Crawler("EventsCrawler", {
 *   role: crawlerRole.roleArn,
 *   databaseName: database.databaseName,
 *   targets: { s3Targets: [{ path: "s3://my-data-lake/events/" }] },
 *   schedule: "cron(0 12 * * ? *)",
 *   tablePrefix: "raw_",
 *   schemaChangePolicy: {
 *     updateBehavior: "UPDATE_IN_DATABASE",
 *     deleteBehavior: "DEPRECATE_IN_DATABASE",
 *   },
 * });
 * ```
 *
 * @resource
 */
export const Crawler = Resource("AWS.Glue.Crawler");
const toTargets = (targets) => ({
    S3Targets: targets.s3Targets?.map((t) => ({
        Path: t.path,
        Exclusions: t.exclusions,
        ConnectionName: t.connectionName,
        SampleSize: t.sampleSize,
        EventQueueArn: t.eventQueueArn,
        DlqEventQueueArn: t.dlqEventQueueArn,
    })),
    JdbcTargets: targets.jdbcTargets?.map((t) => ({
        ConnectionName: t.connectionName,
        Path: t.path,
        Exclusions: t.exclusions,
    })),
    DynamoDBTargets: targets.dynamoDbTargets?.map((t) => ({
        Path: t.path,
        scanAll: t.scanAll,
        scanRate: t.scanRate,
    })),
    CatalogTargets: targets.catalogTargets?.map((t) => ({
        DatabaseName: t.databaseName,
        Tables: t.tables,
        ConnectionName: t.connectionName,
    })),
});
export const CrawlerProvider = () => Provider.effect(Crawler, Effect.gen(function* () {
    const createName = Effect.fn(function* (id, props) {
        return (props.crawlerName ??
            (yield* createPhysicalName({ id, maxLength: 255 })));
    });
    const observe = Effect.fn(function* (name) {
        return yield* glue.getCrawler({ Name: name }).pipe(Effect.map((r) => r.Crawler), Effect.catchTag("EntityNotFoundException", () => Effect.succeed(undefined)));
    });
    return Crawler.Provider.of({
        stables: ["crawlerName", "crawlerArn"],
        list: () => Effect.gen(function* () {
            const { accountId, region } = yield* AWSEnvironment.current;
            const pages = yield* glue.getCrawlers
                .pages({})
                .pipe(Stream.runCollect);
            return Array.from(pages)
                .flatMap((page) => page.Crawlers ?? [])
                .filter((c) => c.Name !== undefined)
                .map((c) => ({
                crawlerName: c.Name,
                crawlerArn: crawlerArn(region, accountId, c.Name),
                role: c.Role ?? "",
                databaseName: c.DatabaseName,
                state: c.State,
            }));
        }),
        read: Effect.fn(function* ({ id, olds, output }) {
            const { accountId, region } = yield* AWSEnvironment.current;
            const name = output?.crawlerName ?? (yield* createName(id, olds ?? {}));
            const crawler = yield* observe(name);
            if (crawler?.Name === undefined)
                return undefined;
            const arn = crawlerArn(region, accountId, crawler.Name);
            const attrs = {
                crawlerName: crawler.Name,
                crawlerArn: arn,
                role: crawler.Role ?? "",
                databaseName: crawler.DatabaseName,
                state: crawler.State,
            };
            const tags = yield* fetchObservedTags(arn);
            return (yield* hasAlchemyTags(id, tags)) ? attrs : Unowned(attrs);
        }),
        diff: Effect.fn(function* ({ id, news, olds }) {
            if (!isResolved(news))
                return undefined;
            const oldName = yield* createName(id, olds);
            const newName = yield* createName(id, news);
            if (oldName !== newName)
                return { action: "replace" };
            // role / targets / schedule / policies / description → update
        }),
        reconcile: Effect.fn(function* ({ id, news, output, session }) {
            const { accountId, region } = yield* AWSEnvironment.current;
            const name = output?.crawlerName ?? (yield* createName(id, news));
            const internalTags = yield* createInternalTags(id);
            const desiredTags = { ...news.tags, ...internalTags };
            const arn = crawlerArn(region, accountId, name);
            const common = {
                Role: news.role,
                DatabaseName: news.databaseName,
                Description: news.description,
                Targets: toTargets(news.targets),
                Schedule: news.schedule,
                Classifiers: news.classifiers,
                TablePrefix: news.tablePrefix,
                SchemaChangePolicy: news.schemaChangePolicy
                    ? {
                        UpdateBehavior: news.schemaChangePolicy.updateBehavior,
                        DeleteBehavior: news.schemaChangePolicy.deleteBehavior,
                    }
                    : undefined,
                RecrawlPolicy: news.recrawlPolicy
                    ? { RecrawlBehavior: news.recrawlPolicy.recrawlBehavior }
                    : undefined,
                Configuration: news.configuration,
            };
            // 1. OBSERVE
            let crawler = yield* observe(name);
            // 2. ENSURE / 3. SYNC
            if (crawler === undefined) {
                yield* retryWhileCrawlerTargetNotReady(retryWhileRoleNotAssumable(glue.createCrawler({
                    Name: name,
                    ...common,
                    Tags: desiredTags,
                }))).pipe(Effect.catchTag("AlreadyExistsException", () => Effect.void));
            }
            else {
                // updateCrawler fails with CrawlerRunningException mid-crawl and
                // with GlueRoleNotAssumable during IAM propagation.
                yield* retryWhileCrawlerRunning(retryWhileCrawlerTargetNotReady(retryWhileRoleNotAssumable(glue.updateCrawler({ Name: name, ...common }))));
            }
            // 3b. SYNC TAGS
            const observedTags = yield* fetchObservedTags(arn);
            yield* syncTags(arn, observedTags, desiredTags);
            crawler = yield* observe(name);
            yield* session.note(name);
            return {
                crawlerName: name,
                crawlerArn: arn,
                role: crawler?.Role ?? news.role,
                databaseName: crawler?.DatabaseName ?? news.databaseName,
                state: crawler?.State,
            };
        }),
        delete: Effect.fn(function* ({ output }) {
            const name = output.crawlerName;
            let crawler = yield* observe(name);
            if (crawler === undefined)
                return;
            if (crawler.State === "RUNNING") {
                yield* glue
                    .stopCrawler({ Name: name })
                    .pipe(Effect.catchTag([
                    "CrawlerNotRunningException",
                    "CrawlerStoppingException",
                    "EntityNotFoundException",
                ], () => Effect.void));
            }
            // Stop is asynchronous. Wait for READY (deletable) or absence;
            // interrupted deletes can resume from RUNNING/STOPPING safely.
            crawler = yield* Effect.repeat(observe(name), {
                schedule: Schedule.fixed("2 seconds"),
                until: (current) => current === undefined || current.State === "READY",
                times: 15,
            });
            if (crawler === undefined)
                return;
            yield* retryCrawlerDelete(glue.deleteCrawler({ Name: name })).pipe(Effect.catchTag("EntityNotFoundException", () => Effect.void));
            const remaining = yield* Effect.repeat(observe(name), {
                schedule: Schedule.fixed("2 seconds"),
                until: (current) => current === undefined,
                times: 15,
            });
            if (remaining !== undefined) {
                return yield* Effect.fail(new glue.OperationTimeoutException({
                    message: `crawler ${name} remained visible after delete for 30 seconds`,
                }));
            }
        }),
    });
}));
//# sourceMappingURL=Crawler.js.map