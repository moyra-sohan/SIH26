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
 * An Amazon Forecast dataset group — a domain-scoped container that groups the
 * datasets used to train predictors. Creating the group is cheap; the
 * expensive training work lives in predictors and forecasts provisioned
 * separately.
 *
 * ### Creating a Dataset Group
 * **Example:** Custom Dataset Group
 * ```typescript
 * const group = yield* Forecast.DatasetGroup("Sales", {
 *   domain: "CUSTOM",
 * });
 * ```
 *
 * **Example:** Dataset Group with Attached Datasets
 * ```typescript
 * const group = yield* Forecast.DatasetGroup("Sales", {
 *   domain: "RETAIL",
 *   datasetArns: [dataset.datasetArn],
 *   tags: { team: "planning" },
 * });
 * ```
 *
 * @resource
 */
export const DatasetGroup = Resource("AWS.Forecast.DatasetGroup");
const sameArns = (a, b) => {
    const sa = [...a].sort();
    const sb = [...b].sort();
    return sa.length === sb.length && sa.every((v, i) => v === sb[i]);
};
export const DatasetGroupProvider = () => Provider.effect(DatasetGroup, Effect.gen(function* () {
    const createName = Effect.fn(function* (id, props) {
        return (props.datasetGroupName ??
            toForecastName(yield* createPhysicalName({ id, maxLength: 63 })));
    });
    const describe = Effect.fn(function* (datasetGroupArn) {
        return yield* forecast
            .describeDatasetGroup({ DatasetGroupArn: datasetGroupArn })
            .pipe(Effect.catchTag("ResourceNotFoundException", () => Effect.succeed(undefined)));
    });
    const toAttrs = (group) => ({
        datasetGroupArn: group.DatasetGroupArn,
        datasetGroupName: group.DatasetGroupName,
        domain: group.Domain,
        status: group.Status,
    });
    return {
        stables: ["datasetGroupArn", "datasetGroupName"],
        diff: Effect.fn(function* ({ id, olds, news }) {
            if (!isResolved(news))
                return undefined;
            const oldName = yield* createName(id, olds);
            const newName = yield* createName(id, news);
            if (oldName !== newName ||
                (olds.domain ?? undefined) !== (news.domain ?? undefined)) {
                return { action: "replace" };
            }
        }),
        read: Effect.fn(function* ({ id, output }) {
            if (!output?.datasetGroupArn)
                return undefined;
            const group = yield* describe(output.datasetGroupArn);
            if (group === undefined)
                return undefined;
            const attrs = toAttrs(group);
            const tags = yield* readForecastTags(group.DatasetGroupArn);
            return (yield* hasAlchemyTags(id, tags)) ? attrs : Unowned(attrs);
        }),
        reconcile: Effect.fn(function* ({ id, news, output, session }) {
            const name = yield* createName(id, news);
            const internalTags = yield* createInternalTags(id);
            const desiredTags = { ...internalTags, ...news.tags };
            const desiredArns = news.datasetArns ?? [];
            // 1. Observe — cloud state is authoritative; output is an ARN cache.
            let group = output?.datasetGroupArn !== undefined
                ? yield* describe(output.datasetGroupArn)
                : undefined;
            // 2. Ensure — create if missing.
            if (group === undefined) {
                const created = yield* forecast.createDatasetGroup({
                    DatasetGroupName: name,
                    Domain: news.domain,
                    DatasetArns: desiredArns,
                    Tags: Object.entries(desiredTags).map(([Key, Value]) => ({
                        Key,
                        Value,
                    })),
                });
                group = yield* describe(created.DatasetGroupArn);
            }
            else {
                // 3. Sync attached datasets — in-place update on drift.
                if (!sameArns(group.DatasetArns ?? [], desiredArns)) {
                    yield* forecast.updateDatasetGroup({
                        DatasetGroupArn: group.DatasetGroupArn,
                        DatasetArns: desiredArns,
                    });
                }
                // 3b. Sync tags — diff against OBSERVED cloud tags.
                yield* syncForecastTags(group.DatasetGroupArn, desiredTags);
            }
            const arn = group.DatasetGroupArn;
            yield* session.note(arn);
            const fresh = (yield* describe(arn)) ?? group;
            return toAttrs(fresh);
        }),
        delete: Effect.fn(function* ({ output }) {
            yield* forecast
                .deleteDatasetGroup({ DatasetGroupArn: output.datasetGroupArn })
                .pipe(Effect.catchTag("ResourceNotFoundException", () => Effect.void), Effect.retry({
                while: (e) => e._tag === "ResourceInUseException",
                schedule: Schedule.max([
                    Schedule.fixed("3 seconds"),
                    Schedule.recurs(20),
                ]),
            }));
        }),
        list: () => forecast.listDatasetGroups.pages({}).pipe(Stream.runCollect, Effect.map((chunk) => Array.from(chunk).flatMap((page) => page.DatasetGroups ?? [])), Effect.flatMap(Effect.forEach((summary) => describe(summary.DatasetGroupArn).pipe(Effect.map((g) => (g ? toAttrs(g) : undefined))), { concurrency: 4 })), Effect.map((items) => items.filter((item) => item !== undefined))),
    };
}));
//# sourceMappingURL=DatasetGroup.js.map