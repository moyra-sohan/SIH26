import * as quicksight from "@distilled.cloud/aws/quicksight";
import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";
import { Unowned } from "../../AdoptPolicy.js";
import { isResolved } from "../../Diff.js";
import { createPhysicalName } from "../../PhysicalName.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
import { createInternalTags, hasAlchemyTags } from "../../Tags.js";
import { AWSEnvironment } from "../Environment.js";
import { readQuickSightTags, syncQuickSightTags, toWireTags, } from "./internal.js";
/**
 * An Amazon QuickSight dataset — a prepared, queryable model built on top of
 * one or more data sources.
 *
 * QuickSight requires an active account subscription in the region. Without
 * one, create operations fail with the typed `QuickSightSubscriptionRequired`
 * error.
 *
 * ### Creating a Dataset
 * **Example:** SPICE Dataset from a Relational Table
 * ```typescript
 * const dataset = yield* DataSet("sales", {
 *   name: "Sales",
 *   importMode: "SPICE",
 *   physicalTableMap: {
 *     sales: {
 *       RelationalTable: {
 *         DataSourceArn: source.arn,
 *         Name: "sales",
 *         InputColumns: [{ Name: "amount", Type: "DECIMAL" }],
 *       },
 *     },
 *   },
 * });
 * ```
 *
 * @resource
 */
export const DataSet = Resource("AWS.QuickSight.DataSet");
export const DataSetProvider = () => Provider.effect(DataSet, Effect.gen(function* () {
    const toId = (id, props) => props.dataSetId
        ? Effect.succeed(props.dataSetId)
        : createPhysicalName({ id, maxLength: 64 });
    const readSet = Effect.fn(function* (accountId, dataSetId) {
        const response = yield* quicksight
            .describeDataSet({ AwsAccountId: accountId, DataSetId: dataSetId })
            .pipe(Effect.catchTag("ResourceNotFoundException", () => Effect.succeed(undefined)));
        return response?.DataSet;
    });
    const toAttrs = (set) => ({
        dataSetId: set.DataSetId,
        arn: set.Arn,
        name: set.Name ?? "",
    });
    return DataSet.Provider.of({
        stables: ["dataSetId", "arn"],
        diff: Effect.fn(function* ({ id, olds = {}, news }) {
            if (!isResolved(news))
                return undefined;
            if ((yield* toId(id, olds)) !== (yield* toId(id, news))) {
                return { action: "replace" };
            }
        }),
        read: Effect.fn(function* ({ id, olds = {}, output }) {
            const { accountId } = yield* AWSEnvironment.current;
            const dataSetId = output?.dataSetId ?? (yield* toId(id, olds));
            const set = yield* readSet(accountId, dataSetId);
            if (set === undefined)
                return undefined;
            const attrs = toAttrs(set);
            const tags = yield* readQuickSightTags(attrs.arn);
            return (yield* hasAlchemyTags(id, tags)) ? attrs : Unowned(attrs);
        }),
        reconcile: Effect.fn(function* ({ id, news, output, session }) {
            const { accountId } = yield* AWSEnvironment.current;
            const dataSetId = output?.dataSetId ?? (yield* toId(id, news));
            const internalTags = yield* createInternalTags(id);
            const desiredTags = { ...internalTags, ...news.tags };
            // 1. Observe.
            let observed = yield* readSet(accountId, dataSetId);
            // 2. Ensure — create if missing (tolerate AlreadyExists race).
            if (observed === undefined) {
                yield* quicksight
                    .createDataSet({
                    AwsAccountId: accountId,
                    DataSetId: dataSetId,
                    Name: news.name,
                    PhysicalTableMap: news.physicalTableMap,
                    ImportMode: news.importMode,
                    LogicalTableMap: news.logicalTableMap,
                    ColumnGroups: news.columnGroups,
                    FieldFolders: news.fieldFolders,
                    Permissions: news.permissions,
                    RowLevelPermissionDataSet: news.rowLevelPermissionDataSet,
                    DataSetUsageConfiguration: news.dataSetUsageConfiguration,
                    DatasetParameters: news.datasetParameters,
                    Tags: toWireTags(desiredTags),
                })
                    .pipe(Effect.catchTag("ResourceExistsException", () => Effect.void));
            }
            else {
                // 3. Sync — idempotent update of the dataset definition.
                yield* quicksight.updateDataSet({
                    AwsAccountId: accountId,
                    DataSetId: dataSetId,
                    Name: news.name,
                    PhysicalTableMap: news.physicalTableMap,
                    ImportMode: news.importMode,
                    LogicalTableMap: news.logicalTableMap,
                    ColumnGroups: news.columnGroups,
                    FieldFolders: news.fieldFolders,
                    RowLevelPermissionDataSet: news.rowLevelPermissionDataSet,
                    DataSetUsageConfiguration: news.dataSetUsageConfiguration,
                    DatasetParameters: news.datasetParameters,
                });
            }
            observed = yield* readSet(accountId, dataSetId);
            if (observed === undefined) {
                return yield* Effect.fail(new Error(`QuickSight dataset '${dataSetId}' not found after reconcile`));
            }
            // 3b. Sync tags.
            yield* syncQuickSightTags(observed.Arn, desiredTags);
            yield* session.note(dataSetId);
            return toAttrs(observed);
        }),
        delete: Effect.fn(function* ({ output }) {
            const { accountId } = yield* AWSEnvironment.current;
            yield* quicksight
                .deleteDataSet({
                AwsAccountId: accountId,
                DataSetId: output.dataSetId,
            })
                .pipe(Effect.catchTag("ResourceNotFoundException", () => Effect.void));
        }),
        list: () => Effect.gen(function* () {
            const { accountId } = yield* AWSEnvironment.current;
            return yield* quicksight.listDataSets
                .pages({ AwsAccountId: accountId })
                .pipe(Stream.runCollect, Effect.map((chunk) => Array.from(chunk)
                .flatMap((page) => page.DataSetSummaries ?? [])
                .flatMap((s) => s.DataSetId !== undefined && s.Arn !== undefined
                ? [
                    {
                        dataSetId: s.DataSetId,
                        arn: s.Arn,
                        name: s.Name ?? "",
                    },
                ]
                : [])));
        }),
    });
}));
//# sourceMappingURL=DataSet.js.map