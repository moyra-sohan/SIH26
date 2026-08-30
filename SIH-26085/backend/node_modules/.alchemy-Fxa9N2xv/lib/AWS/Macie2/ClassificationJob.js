import * as macie2 from "@distilled.cloud/aws/macie2";
import * as Effect from "effect/Effect";
import { Unowned } from "../../AdoptPolicy.js";
import { isResolved } from "../../Diff.js";
import { createPhysicalName } from "../../PhysicalName.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
import { createInternalTags, diffTags, hasAlchemyTags, tagRecord, } from "../../Tags.js";
import { retryThroughEnablement } from "./common.js";
/**
 * An Amazon Macie classification job — scans one or more S3 buckets for
 * sensitive data. Requires Macie to be enabled for the account (see
 * `Macie2.Session`). Jobs are immutable once created; changing the job type,
 * name, or bucket set replaces the job. Destroy cancels the job.
 *
 * ### Creating a classification job
 * **Example:** One-time job over a bucket
 * ```typescript
 * const job = yield* Macie2.ClassificationJob("Scan", {
 *   jobType: "ONE_TIME",
 *   bucketDefinitions: [{ accountId, buckets: ["my-bucket"] }],
 * });
 * ```
 *
 * **Example:** Sampled scan with a description
 * ```typescript
 * const job = yield* Macie2.ClassificationJob("Scan", {
 *   jobType: "ONE_TIME",
 *   bucketDefinitions: [{ accountId, buckets: ["my-bucket"] }],
 *   samplingPercentage: 20,
 *   description: "PII sweep",
 * });
 * ```
 */
const ClassificationJobResource = Resource("AWS.Macie2.ClassificationJob");
export { ClassificationJobResource as ClassificationJob };
const createName = (id, props) => props.name
    ? Effect.succeed(props.name)
    : createPhysicalName({ id, maxLength: 200 });
// A stable fingerprint of the immutable definition — any change replaces.
const fingerprint = (props) => JSON.stringify({
    jobType: props.jobType ?? "ONE_TIME",
    bucketDefinitions: (props.bucketDefinitions ?? [])
        .map((b) => ({ accountId: b.accountId, buckets: [...b.buckets].sort() }))
        .sort((a, b) => a.accountId.localeCompare(b.accountId)),
});
const buildAttrs = (jobId, d) => ({
    jobId,
    jobArn: d.jobArn,
    name: d.name,
    jobStatus: d.jobStatus,
});
export const ClassificationJobProvider = () => Provider.effect(ClassificationJobResource, Effect.gen(function* () {
    const describe = (jobId) => macie2
        .describeClassificationJob({ jobId })
        .pipe(Effect.catchTag("ResourceNotFoundException", () => Effect.succeed(undefined)));
    return {
        stables: ["jobId", "jobArn", "name"],
        read: Effect.fn(function* ({ id, output }) {
            if (!output?.jobId)
                return undefined;
            const d = yield* describe(output.jobId);
            if (!d)
                return undefined;
            const attrs = buildAttrs(output.jobId, d);
            return (yield* hasAlchemyTags(id, d.tags)) ? attrs : Unowned(attrs);
        }),
        // Classification jobs are enumerable, but they are per-job resources
        // (not a singleton); the engine keys them by logical ID, so return the
        // empty set here and rely on `read` for state refresh.
        list: () => Effect.succeed([]),
        diff: Effect.fn(function* ({ id, news, olds = {} }) {
            if (!isResolved(news))
                return undefined;
            const oldName = yield* createName(id, olds);
            const newName = yield* createName(id, news);
            if (oldName !== newName)
                return { action: "replace" };
            if (fingerprint(olds) !== fingerprint(news)) {
                return { action: "replace" };
            }
            // Jobs are immutable apart from status; nothing else to update.
            return undefined;
        }),
        reconcile: Effect.fn(function* ({ id, news, output, session }) {
            const internalTags = yield* createInternalTags(id);
            const desiredTags = { ...news.tags, ...internalTags };
            const name = output?.name ?? (yield* createName(id, news));
            // 1. OBSERVE — cloud state is authoritative; output is an id cache.
            let jobId = output?.jobId;
            let live = jobId ? yield* describe(jobId) : undefined;
            // 2. ENSURE — create the job if it does not exist.
            if (jobId === undefined || live === undefined) {
                const created = yield* retryThroughEnablement(macie2.createClassificationJob({
                    name,
                    jobType: news.jobType ?? "ONE_TIME",
                    s3JobDefinition: {
                        bucketDefinitions: news.bucketDefinitions.map((b) => ({
                            accountId: b.accountId,
                            buckets: b.buckets,
                        })),
                    },
                    description: news.description,
                    samplingPercentage: news.samplingPercentage,
                    initialRun: news.initialRun,
                    managedDataIdentifierSelector: news.managedDataIdentifierSelector,
                    tags: desiredTags,
                }));
                jobId = created.jobId;
                live = yield* macie2.describeClassificationJob({ jobId });
            }
            else {
                // 3. SYNC tags — the definition is immutable; only tags mutate.
                const { upsert, removed } = diffTags(tagRecord(live.tags), desiredTags);
                if (upsert.length > 0) {
                    yield* macie2.tagResource({
                        resourceArn: live.jobArn,
                        tags: Object.fromEntries(upsert.map((t) => [t.Key, t.Value])),
                    });
                }
                if (removed.length > 0) {
                    yield* macie2.untagResource({
                        resourceArn: live.jobArn,
                        tagKeys: removed,
                    });
                }
            }
            // 4. RETURN fresh attributes.
            const final = yield* macie2.describeClassificationJob({ jobId });
            yield* session.note(jobId);
            return buildAttrs(jobId, final);
        }),
        delete: Effect.fn(function* ({ output }) {
            // Classification jobs cannot be deleted — only cancelled. Cancelling
            // an already-terminal job raises ConflictException; treat as done.
            yield* macie2
                .updateClassificationJob({
                jobId: output.jobId,
                jobStatus: "CANCELLED",
            })
                .pipe(Effect.catchTag("ConflictException", () => Effect.void), Effect.catchTag("ResourceNotFoundException", () => Effect.void));
        }),
    };
}));
//# sourceMappingURL=ClassificationJob.js.map