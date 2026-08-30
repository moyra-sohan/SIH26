import * as cloudwatch from "@distilled.cloud/aws/cloudwatch";
import * as Effect from "effect/Effect";
import * as Schedule from "effect/Schedule";
import { createPhysicalName } from "../../PhysicalName.js";
import { createInternalTags, createTagsList, diffTags } from "../../Tags.js";
export const createName = (id, providedName, maxLength) => providedName
    ? Effect.succeed(providedName)
    : createPhysicalName({
        id,
        maxLength,
    });
export const toTagRecord = (tags) => Object.fromEntries((tags ?? [])
    .filter((tag) => typeof tag.Key === "string" && typeof tag.Value === "string")
    .map((tag) => [tag.Key, tag.Value]));
export const createManagedTags = Effect.fn(function* (id, tags) {
    return {
        ...(yield* createInternalTags(id)),
        ...tags,
    };
});
export const updateResourceTags = Effect.fn(function* ({ id, resourceArn, olds, news, }) {
    const oldTags = olds ? yield* createManagedTags(id, olds) : {};
    const newTags = yield* createManagedTags(id, news);
    const { removed, upsert } = diffTags(oldTags, newTags);
    if (removed.length > 0) {
        yield* cloudwatch.untagResource({
            ResourceARN: resourceArn,
            TagKeys: removed,
        });
    }
    if (upsert.length > 0) {
        yield* cloudwatch.tagResource({
            ResourceARN: resourceArn,
            Tags: upsert,
        });
    }
    return newTags;
});
export const readResourceTags = (resourceArn) => cloudwatch
    .listTagsForResource({
    ResourceARN: resourceArn,
})
    .pipe(Effect.map((response) => toTagRecord(response.Tags)));
export const createTagList = (tags) => createTagsList(tags);
export const retryConcurrent = (effect) => effect.pipe(Effect.retry({
    while: (error) => error?._tag === "ConcurrentModificationException" ||
        error?._tag === "ConflictException" ||
        error?._tag === "LimitExceededException",
    schedule: Schedule.max([Schedule.exponential(200), Schedule.recurs(8)]),
}));
const normalizeDimensions = (dimensions) => [...(dimensions ?? [])].sort((a, b) => `${a.Name ?? ""}:${a.Value ?? ""}`.localeCompare(`${b.Name ?? ""}:${b.Value ?? ""}`));
const normalizeSingleMetricDetector = (input) => {
    const singleMetric = input.SingleMetricAnomalyDetector;
    return {
        Namespace: singleMetric?.Namespace ?? input.Namespace,
        MetricName: singleMetric?.MetricName ?? input.MetricName,
        Dimensions: normalizeDimensions(singleMetric?.Dimensions ?? input.Dimensions),
        Stat: singleMetric?.Stat ?? input.Stat,
    };
};
export const detectorIdentity = (input) => JSON.stringify({
    SingleMetric: normalizeSingleMetricDetector(input),
    MetricMathAnomalyDetector: input.MetricMathAnomalyDetector,
});
export const matchesDetectorIdentity = (detector, input) => detectorIdentity(detector) === detectorIdentity(input);
export const sortByLogicalId = (items) => [...items].sort((a, b) => a.LogicalId.localeCompare(b.LogicalId));
//# sourceMappingURL=common.js.map