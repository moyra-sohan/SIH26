import * as dataexchange from "@distilled.cloud/aws/dataexchange";
import * as Effect from "effect/Effect";
import * as Schedule from "effect/Schedule";
import * as Stream from "effect/Stream";
import { Unowned } from "../../AdoptPolicy.js";
import { isResolved } from "../../Diff.js";
import { createPhysicalName } from "../../PhysicalName.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
import { createInternalTags, hasAlchemyTags } from "../../Tags.js";
import { readDataExchangeTags, syncDataExchangeTags } from "./internal.js";
/**
 * An AWS Data Exchange data set — the top-level container that data providers
 * publish revisions of data into. An owned data set holds revisions, each of
 * which holds assets (e.g. S3 snapshot files) that subscribers receive.
 *
 * ### Creating Data Sets
 * **Example:** Basic S3-snapshot data set
 * ```typescript
 * import * as AWS from "alchemy/AWS";
 *
 * const dataSet = yield* AWS.DataExchange.DataSet("Prices", {
 *   description: "Daily commodity price snapshots",
 * });
 * ```
 *
 * **Example:** Named data set with tags
 * ```typescript
 * const dataSet = yield* AWS.DataExchange.DataSet("Prices", {
 *   name: "commodity-prices",
 *   assetType: "S3_SNAPSHOT",
 *   description: "Daily commodity price snapshots",
 *   tags: { team: "data" },
 * });
 * ```
 *
 * ### Publishing Revisions
 * **Example:** Add a revision to a data set
 * ```typescript
 * const revision = yield* AWS.DataExchange.Revision("PricesV1", {
 *   dataSetId: dataSet.dataSetId,
 *   comment: "Initial snapshot",
 * });
 * ```
 *
 * @resource
 */
export const DataSet = Resource("AWS.DataExchange.DataSet");
export const DataSetProvider = () => Provider.effect(DataSet, Effect.gen(function* () {
    const createName = Effect.fn(function* (id, props) {
        return props.name ?? (yield* createPhysicalName({ id, maxLength: 98 }));
    });
    /** Get a data set by id; typed not-found → undefined. */
    const getById = Effect.fn(function* (dataSetId) {
        return yield* dataexchange
            .getDataSet({ DataSetId: dataSetId })
            .pipe(Effect.catchTag("ResourceNotFoundException", () => Effect.succeed(undefined)));
    });
    /**
     * Scan owned data sets for one with the given name. Data set ids are
     * server-generated, so recovery from a lost output (state-persistence
     * failure) goes through the deterministic physical name.
     */
    const findByName = Effect.fn(function* (name) {
        const head = yield* dataexchange.listDataSets
            .items({ Origin: "OWNED" })
            .pipe(Stream.filter((dataSet) => dataSet.Name === name), Stream.runHead);
        if (head._tag === "None")
            return undefined;
        return yield* getById(head.value.Id);
    });
    const toAttrs = (dataSet) => ({
        dataSetId: dataSet.Id,
        dataSetArn: dataSet.Arn,
        name: dataSet.Name,
        assetType: dataSet.AssetType,
        origin: dataSet.Origin,
    });
    return {
        stables: ["dataSetId", "dataSetArn", "assetType", "origin"],
        read: Effect.fn(function* ({ id, olds, output }) {
            const dataSet = output?.dataSetId
                ? yield* getById(output.dataSetId)
                : yield* findByName(yield* createName(id, olds ?? {}));
            if (dataSet === undefined)
                return undefined;
            const attrs = toAttrs(dataSet);
            const tags = yield* readDataExchangeTags(attrs.dataSetArn);
            return (yield* hasAlchemyTags(id, tags)) ? attrs : Unowned(attrs);
        }),
        diff: Effect.fn(function* ({ news, olds }) {
            if (!isResolved(news))
                return undefined;
            // The asset type is immutable; name and description update in place.
            if ((news.assetType ?? "S3_SNAPSHOT") !==
                (olds.assetType ?? "S3_SNAPSHOT")) {
                return { action: "replace" };
            }
        }),
        reconcile: Effect.fn(function* ({ id, news, output, session }) {
            const name = yield* createName(id, news);
            const assetType = news.assetType ?? "S3_SNAPSHOT";
            const description = news.description ?? name;
            const internalTags = yield* createInternalTags(id);
            const desiredTags = { ...news.tags, ...internalTags };
            // 1. Observe — the output id is only a cache; fall back to the
            //    deterministic name when it's missing or stale.
            let dataSet = output?.dataSetId
                ? yield* getById(output.dataSetId)
                : undefined;
            if (dataSet === undefined) {
                dataSet = yield* findByName(name);
            }
            // 2. Ensure — create when missing. Data set names are not unique in
            //    DataExchange, so there is no AlreadyExists race to tolerate.
            if (dataSet === undefined) {
                dataSet = yield* dataexchange.createDataSet({
                    AssetType: assetType,
                    Name: name,
                    Description: description,
                    Tags: desiredTags,
                });
            }
            // 3. Sync — name and description are mutable in place.
            if (dataSet.Name !== name || dataSet.Description !== description) {
                dataSet = yield* dataexchange.updateDataSet({
                    DataSetId: dataSet.Id,
                    Name: name,
                    Description: description,
                });
            }
            // 3b. Sync tags against OBSERVED cloud tags (adoption-safe).
            yield* syncDataExchangeTags(dataSet.Arn, desiredTags);
            yield* session.note(dataSet.Arn);
            return {
                dataSetId: dataSet.Id,
                dataSetArn: dataSet.Arn,
                name,
                assetType: dataSet.AssetType ?? assetType,
                origin: dataSet.Origin ?? "OWNED",
            };
        }),
        delete: Effect.fn(function* ({ output }) {
            yield* dataexchange
                .deleteDataSet({ DataSetId: output.dataSetId })
                .pipe(
            // A revision-deletion race can transiently reject the delete;
            // the engine deletes revisions first, so retry briefly.
            Effect.retry({
                while: (e) => e._tag === "ConflictException",
                schedule: Schedule.max([
                    Schedule.fixed("2 seconds"),
                    Schedule.recurs(10),
                ]),
            }), Effect.catchTag("ResourceNotFoundException", () => Effect.void));
        }),
        list: () => dataexchange.listDataSets.items({}).pipe(Stream.map((entry) => ({
            dataSetId: entry.Id,
            dataSetArn: entry.Arn,
            name: entry.Name,
            assetType: entry.AssetType,
            origin: entry.Origin,
        })), Stream.runCollect, Effect.map((chunk) => Array.from(chunk))),
    };
}));
//# sourceMappingURL=DataSet.js.map