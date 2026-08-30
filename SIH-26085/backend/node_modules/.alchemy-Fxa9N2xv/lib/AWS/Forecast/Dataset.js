import * as forecast from "@distilled.cloud/aws/forecast";
import * as Effect from "effect/Effect";
import * as Schedule from "effect/Schedule";
import * as Stream from "effect/Stream";
import { Unowned } from "../../AdoptPolicy.js";
import { isResolved } from "../../Diff.js";
import { createPhysicalName } from "../../PhysicalName.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
import { createInternalTags, hasAlchemyTags } from "../../Tags.js";
import { readForecastTags, syncForecastTags, toForecastName, } from "./internal.js";
/**
 * An Amazon Forecast dataset — a typed, domain-scoped collection of
 * time-series (or metadata) records described by a schema. Creating the
 * dataset is a cheap metadata operation; bulk imports and training happen
 * through separate import jobs and predictors.
 *
 * ### Creating a Dataset
 * **Example:** Target Time-Series Dataset
 * ```typescript
 * const dataset = yield* Forecast.Dataset("Demand", {
 *   domain: "CUSTOM",
 *   datasetType: "TARGET_TIME_SERIES",
 *   dataFrequency: "D",
 *   schema: {
 *     attributes: [
 *       { attributeName: "item_id", attributeType: "string" },
 *       { attributeName: "timestamp", attributeType: "timestamp" },
 *       { attributeName: "target_value", attributeType: "float" },
 *     ],
 *   },
 * });
 * ```
 *
 * @resource
 */
export const Dataset = Resource("AWS.Forecast.Dataset");
export const DatasetProvider = () => Provider.effect(Dataset, Effect.gen(function* () {
    const createName = Effect.fn(function* (id, props) {
        return (props.datasetName ??
            toForecastName(yield* createPhysicalName({ id, maxLength: 63 })));
    });
    const describe = Effect.fn(function* (datasetArn) {
        return yield* forecast
            .describeDataset({ DatasetArn: datasetArn })
            .pipe(Effect.catchTag("ResourceNotFoundException", () => Effect.succeed(undefined)));
    });
    const toAttrs = (dataset) => ({
        datasetArn: dataset.DatasetArn,
        datasetName: dataset.DatasetName,
        domain: dataset.Domain,
        datasetType: dataset.DatasetType,
        status: dataset.Status,
    });
    return {
        stables: ["datasetArn", "datasetName"],
        diff: Effect.fn(function* ({ id, olds, news }) {
            if (!isResolved(news))
                return undefined;
            const oldName = yield* createName(id, olds);
            const newName = yield* createName(id, news);
            if (oldName !== newName ||
                (olds.domain ?? undefined) !== (news.domain ?? undefined) ||
                (olds.datasetType ?? undefined) !==
                    (news.datasetType ?? undefined) ||
                (olds.dataFrequency ?? undefined) !==
                    (news.dataFrequency ?? undefined) ||
                JSON.stringify(olds.schema ?? null) !==
                    JSON.stringify(news.schema ?? null)) {
                return { action: "replace" };
            }
        }),
        read: Effect.fn(function* ({ id, output }) {
            if (!output?.datasetArn)
                return undefined;
            const dataset = yield* describe(output.datasetArn);
            if (dataset === undefined)
                return undefined;
            const attrs = toAttrs(dataset);
            const tags = yield* readForecastTags(dataset.DatasetArn);
            return (yield* hasAlchemyTags(id, tags)) ? attrs : Unowned(attrs);
        }),
        reconcile: Effect.fn(function* ({ id, news, output, session }) {
            const name = yield* createName(id, news);
            const internalTags = yield* createInternalTags(id);
            const desiredTags = { ...internalTags, ...news.tags };
            let dataset = output?.datasetArn !== undefined
                ? yield* describe(output.datasetArn)
                : undefined;
            if (dataset === undefined) {
                const created = yield* forecast.createDataset({
                    DatasetName: name,
                    Domain: news.domain,
                    DatasetType: news.datasetType,
                    DataFrequency: news.dataFrequency,
                    Schema: {
                        Attributes: news.schema.attributes.map((a) => ({
                            AttributeName: a.attributeName,
                            AttributeType: a.attributeType,
                        })),
                    },
                    EncryptionConfig: news.encryptionConfig
                        ? {
                            RoleArn: news.encryptionConfig.roleArn,
                            KMSKeyArn: news.encryptionConfig.kmsKeyArn,
                        }
                        : undefined,
                    Tags: Object.entries(desiredTags).map(([Key, Value]) => ({
                        Key,
                        Value,
                    })),
                });
                dataset = yield* describe(created.DatasetArn);
            }
            else {
                yield* syncForecastTags(dataset.DatasetArn, desiredTags);
            }
            yield* session.note(dataset.DatasetArn);
            return toAttrs(dataset);
        }),
        delete: Effect.fn(function* ({ output }) {
            yield* forecast.deleteDataset({ DatasetArn: output.datasetArn }).pipe(Effect.catchTag("ResourceNotFoundException", () => Effect.void), Effect.retry({
                while: (e) => e._tag === "ResourceInUseException",
                schedule: Schedule.max([
                    Schedule.fixed("3 seconds"),
                    Schedule.recurs(20),
                ]),
            }));
        }),
        list: () => forecast.listDatasets.pages({}).pipe(Stream.runCollect, Effect.map((chunk) => Array.from(chunk).flatMap((page) => page.Datasets ?? [])), Effect.flatMap(Effect.forEach((summary) => describe(summary.DatasetArn).pipe(Effect.map((d) => (d ? toAttrs(d) : undefined))), { concurrency: 4 })), Effect.map((items) => items.filter((item) => item !== undefined))),
    };
}));
//# sourceMappingURL=Dataset.js.map