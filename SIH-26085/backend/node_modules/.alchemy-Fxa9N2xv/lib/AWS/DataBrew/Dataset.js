import * as databrew from "@distilled.cloud/aws/databrew";
import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";
import { Unowned } from "../../AdoptPolicy.js";
import { isResolved } from "../../Diff.js";
import { createPhysicalName } from "../../PhysicalName.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
import { createInternalTags, hasAlchemyTags } from "../../Tags.js";
import { AWSEnvironment } from "../Environment.js";
import { databrewArn, fetchObservedTags, retryWhileConflict, syncTags, } from "./internal.js";
/**
 * An AWS Glue DataBrew dataset — a pointer to source data (S3 file/prefix,
 * Glue Data Catalog table, or JDBC query) plus parsing options. The dataset
 * definition itself stores no data and is free; it is consumed by DataBrew
 * projects and jobs.
 * ### Creating Datasets
 * **Example:** CSV Dataset from S3
 * ```typescript
 * import * as AWS from "alchemy/AWS";
 *
 * const dataset = yield* AWS.DataBrew.Dataset("Sales", {
 *   format: "CSV",
 *   formatOptions: { csv: { delimiter: ",", headerRow: true } },
 *   input: {
 *     s3InputDefinition: {
 *       bucket: bucket.bucketName,
 *       key: "raw/sales.csv",
 *     },
 *   },
 * });
 * ```
 *
 * **Example:** JSON Dataset
 * ```typescript
 * const dataset = yield* AWS.DataBrew.Dataset("Events", {
 *   format: "JSON",
 *   formatOptions: { json: { multiLine: false } },
 *   input: {
 *     s3InputDefinition: { bucket: bucket.bucketName, key: "events/" },
 *   },
 * });
 * ```
 *
 * ### Glue Data Catalog
 * **Example:** Dataset from a Catalog Table
 * ```typescript
 * const dataset = yield* AWS.DataBrew.Dataset("Curated", {
 *   input: {
 *     dataCatalogInputDefinition: {
 *       databaseName: glueDatabase.databaseName,
 *       tableName: "curated_sales",
 *     },
 *   },
 * });
 * ```
 *
 * @resource
 */
export const Dataset = Resource("AWS.DataBrew.Dataset");
export const buildS3Location = (location) => ({
    Bucket: location.bucket,
    Key: location.key,
    BucketOwner: location.bucketOwner,
});
const buildFilterExpression = (filter) => ({
    Expression: filter.expression,
    ValuesMap: filter.valuesMap,
});
const buildInput = (input) => ({
    S3InputDefinition: input.s3InputDefinition
        ? buildS3Location(input.s3InputDefinition)
        : undefined,
    DataCatalogInputDefinition: input.dataCatalogInputDefinition
        ? {
            CatalogId: input.dataCatalogInputDefinition.catalogId,
            DatabaseName: input.dataCatalogInputDefinition.databaseName,
            TableName: input.dataCatalogInputDefinition.tableName,
            TempDirectory: input.dataCatalogInputDefinition.tempDirectory
                ? buildS3Location(input.dataCatalogInputDefinition.tempDirectory)
                : undefined,
        }
        : undefined,
    DatabaseInputDefinition: input.databaseInputDefinition
        ? {
            GlueConnectionName: input.databaseInputDefinition.glueConnectionName,
            DatabaseTableName: input.databaseInputDefinition.databaseTableName,
            TempDirectory: input.databaseInputDefinition.tempDirectory
                ? buildS3Location(input.databaseInputDefinition.tempDirectory)
                : undefined,
            QueryString: input.databaseInputDefinition.queryString,
        }
        : undefined,
});
const buildFormatOptions = (options) => options
    ? {
        Json: options.json ? { MultiLine: options.json.multiLine } : undefined,
        Excel: options.excel
            ? {
                SheetNames: options.excel.sheetNames,
                SheetIndexes: options.excel.sheetIndexes,
                HeaderRow: options.excel.headerRow,
            }
            : undefined,
        Csv: options.csv
            ? {
                Delimiter: options.csv.delimiter,
                HeaderRow: options.csv.headerRow,
            }
            : undefined,
    }
    : undefined;
const buildPathOptions = (options) => options
    ? {
        LastModifiedDateCondition: options.lastModifiedDateCondition
            ? buildFilterExpression(options.lastModifiedDateCondition)
            : undefined,
        FilesLimit: options.filesLimit
            ? {
                MaxFiles: options.filesLimit.maxFiles,
                OrderedBy: options.filesLimit.orderedBy,
                Order: options.filesLimit.order,
            }
            : undefined,
        Parameters: options.parameters
            ? Object.fromEntries(Object.entries(options.parameters).map(([key, param]) => [
                key,
                {
                    Name: param.name,
                    Type: param.type,
                    DatetimeOptions: param.datetimeOptions
                        ? {
                            Format: param.datetimeOptions.format,
                            TimezoneOffset: param.datetimeOptions.timezoneOffset,
                            LocaleCode: param.datetimeOptions.localeCode,
                        }
                        : undefined,
                    CreateColumn: param.createColumn,
                    Filter: param.filter
                        ? buildFilterExpression(param.filter)
                        : undefined,
                },
            ]))
            : undefined,
    }
    : undefined;
export const DatasetProvider = () => Provider.effect(Dataset, Effect.gen(function* () {
    const createName = Effect.fn(function* (id, props) {
        return (props.datasetName ??
            (yield* createPhysicalName({ id, maxLength: 255 })));
    });
    const observe = Effect.fn(function* (name) {
        return yield* databrew
            .describeDataset({ Name: name })
            .pipe(Effect.catchTag("ResourceNotFoundException", () => Effect.succeed(undefined)));
    });
    const buildDefinition = (props) => ({
        Format: props.format,
        FormatOptions: buildFormatOptions(props.formatOptions),
        Input: buildInput(props.input),
        PathOptions: buildPathOptions(props.pathOptions),
    });
    return Dataset.Provider.of({
        stables: ["datasetName", "datasetArn"],
        list: () => Effect.gen(function* () {
            const { accountId, region } = yield* AWSEnvironment.current;
            const pages = yield* databrew.listDatasets
                .pages({})
                .pipe(Stream.runCollect);
            return Array.from(pages)
                .flatMap((page) => page.Datasets ?? [])
                .map((d) => ({
                datasetName: d.Name,
                datasetArn: d.ResourceArn ??
                    databrewArn(region, accountId, "dataset", d.Name),
            }));
        }),
        read: Effect.fn(function* ({ id, olds, output }) {
            const { accountId, region } = yield* AWSEnvironment.current;
            const name = output?.datasetName ?? (yield* createName(id, olds ?? {}));
            const dataset = yield* observe(name);
            if (dataset === undefined)
                return undefined;
            const arn = dataset.ResourceArn ??
                databrewArn(region, accountId, "dataset", name);
            const attrs = { datasetName: name, datasetArn: arn };
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
            // everything else is UpdateDataset-able
        }),
        reconcile: Effect.fn(function* ({ id, news, output, session }) {
            const { accountId, region } = yield* AWSEnvironment.current;
            const name = output?.datasetName ?? (yield* createName(id, news));
            const internalTags = yield* createInternalTags(id);
            const desiredTags = { ...news.tags, ...internalTags };
            // 1. OBSERVE
            const dataset = yield* observe(name);
            // 2. ENSURE / 3. SYNC — UpdateDataset is a full PUT of the definition
            if (dataset === undefined) {
                yield* databrew
                    .createDataset({
                    Name: name,
                    ...buildDefinition(news),
                    Tags: desiredTags,
                })
                    .pipe(
                // creation race — another reconcile won; fall through to sync
                Effect.catchTag("ConflictException", () => Effect.void));
            }
            else {
                yield* databrew.updateDataset({
                    Name: name,
                    ...buildDefinition(news),
                });
            }
            const arn = dataset?.ResourceArn ??
                databrewArn(region, accountId, "dataset", name);
            // 3b. SYNC TAGS against observed cloud tags
            const observedTags = yield* fetchObservedTags(arn);
            yield* syncTags(arn, observedTags, desiredTags);
            yield* session.note(name);
            return { datasetName: name, datasetArn: arn };
        }),
        delete: Effect.fn(function* ({ output }) {
            // A ConflictException surfaces briefly after an associated project
            // or job is deleted (eventual consistency) — retry bounded.
            yield* retryWhileConflict(databrew.deleteDataset({ Name: output.datasetName })).pipe(Effect.catchTag("ResourceNotFoundException", () => Effect.succeed(undefined)));
        }),
    });
}));
//# sourceMappingURL=Dataset.js.map