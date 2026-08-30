import * as textract from "@distilled.cloud/aws/textract";
import * as Effect from "effect/Effect";
import * as Schedule from "effect/Schedule";
import { isResolved } from "../../Diff.js";
import { createPhysicalName } from "../../PhysicalName.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
import { createInternalTags, diffTags } from "../../Tags.js";
import { AWSEnvironment } from "../Environment.js";
/**
 * An Amazon Textract adapter — a container for custom, trained adapter
 * versions that enhance the pre-trained Queries feature for your specific
 * documents. The adapter itself is cheap metadata (name, feature types,
 * auto-update, tags); versions are trained separately with
 * `CreateAdapterVersion` against an annotated dataset.
 *
 * ### Managing Adapters
 * **Example:** Create an adapter for the Queries feature
 * ```typescript
 * const adapter = yield* AWS.Textract.Adapter("InvoiceAdapter", {
 *   featureTypes: ["QUERIES"],
 *   description: "Tuned for invoice layouts",
 *   autoUpdate: "ENABLED",
 * });
 * ```
 *
 * **Example:** Analyze a document with a trained adapter version
 * ```typescript
 * const analyzeDocument = yield* AWS.Textract.AnalyzeDocument();
 * const result = yield* analyzeDocument({
 *   Document: { S3Object: { Bucket: bucketName, Name: "invoice.pdf" } },
 *   FeatureTypes: ["QUERIES"],
 *   QueriesConfig: { Queries: [{ Text: "What is the invoice total?" }] },
 *   AdaptersConfig: {
 *     Adapters: [{ AdapterId: adapter.adapterId, Version: "1" }],
 *   },
 * });
 * ```
 *
 * @resource
 */
export const Adapter = Resource("AWS.Textract.Adapter");
const toAttributes = (arn, adapter) => ({
    adapterId: adapter.AdapterId,
    adapterArn: arn,
    adapterName: adapter.AdapterName ?? "",
    featureTypes: [...(adapter.FeatureTypes ?? [])],
    autoUpdate: adapter.AutoUpdate,
    creationTime: adapter.CreationTime?.toISOString(),
});
// Textract's adapter management APIs have very low default rates (~1 TPS);
// bounded backoff absorbs the short bursts the engine's read/diff/reconcile
// sequence emits.
const throttleRetry = (effect) => effect.pipe(Effect.retry({
    while: (e) => e._tag === "ProvisionedThroughputExceededException" ||
        e._tag === "ThrottlingException",
    schedule: Schedule.exponential("1 second"),
    times: 5,
}));
const normalizeTags = (tags) => Object.fromEntries(Object.entries(tags ?? {}).filter((entry) => entry[1] !== undefined));
export const AdapterProvider = () => Provider.effect(Adapter, Effect.gen(function* () {
    // Adapter names must match [a-zA-Z0-9-_]{1,128}; the engine-generated
    // physical name (alphanumerics + dashes) already satisfies it.
    const toName = (id, props) => props.adapterName
        ? Effect.succeed(props.adapterName)
        : createPhysicalName({ id, maxLength: 128 });
    // Confirmed live: Textract adapter ARNs use a nonstandard resource
    // path with a leading slash — `:/adapters/{adapterId}`.
    const adapterArn = (adapterId) => Effect.gen(function* () {
        const { accountId, region } = yield* AWSEnvironment.current;
        return `arn:aws:textract:${region}:${accountId}:/adapters/${adapterId}`;
    });
    const getOne = (adapterId) => throttleRetry(textract.getAdapter({ AdapterId: adapterId })).pipe(Effect.map((adapter) => ({ ...adapter, AdapterId: adapterId })), Effect.catchTag("ResourceNotFoundException", () => Effect.succeed(undefined)));
    // Adapter ids are server-assigned, so recovery without persisted
    // output falls back to a bounded name scan.
    const findByName = (name) => Effect.gen(function* () {
        let nextToken;
        for (let page = 0; page < 25; page++) {
            const res = yield* throttleRetry(textract.listAdapters({ NextToken: nextToken }));
            const match = (res.Adapters ?? []).find((a) => a.AdapterName === name);
            if (match?.AdapterId)
                return match.AdapterId;
            nextToken = res.NextToken;
            if (!nextToken)
                break;
        }
        return undefined;
    });
    return {
        stables: ["adapterId", "adapterArn", "creationTime"],
        diff: Effect.fn(function* ({ olds, news }) {
            if (!isResolved(news))
                return;
            const oldFeatures = [...(olds?.featureTypes ?? [])].sort();
            const newFeatures = [...news.featureTypes].sort();
            if (oldFeatures.length !== newFeatures.length ||
                oldFeatures.some((f, i) => f !== newFeatures[i])) {
                return { action: "replace" };
            }
        }),
        read: Effect.fn(function* ({ id, olds, output }) {
            const adapterId = output?.adapterId ??
                (yield* findByName(yield* toName(id, olds ?? { featureTypes: [] })));
            if (!adapterId)
                return undefined;
            const found = yield* getOne(adapterId);
            if (!found)
                return undefined;
            return toAttributes(yield* adapterArn(adapterId), found);
        }),
        list: () => Effect.gen(function* () {
            const attrs = [];
            let nextToken;
            for (let page = 0; page < 25; page++) {
                const res = yield* throttleRetry(textract.listAdapters({ NextToken: nextToken }));
                for (const overview of res.Adapters ?? []) {
                    if (overview.AdapterId) {
                        const found = yield* getOne(overview.AdapterId);
                        if (found) {
                            attrs.push(toAttributes(yield* adapterArn(overview.AdapterId), found));
                        }
                    }
                }
                nextToken = res.NextToken;
                if (!nextToken)
                    break;
            }
            return attrs;
        }),
        reconcile: Effect.fn(function* ({ id, news, output, session }) {
            const name = yield* toName(id, news);
            const internalTags = yield* createInternalTags(id);
            const desiredTags = { ...news.tags, ...internalTags };
            // Observe — cloud state is authoritative; `output` is only a
            // cached id hint and may be stale.
            let adapterId = output?.adapterId ?? (yield* findByName(name));
            let observed = adapterId ? yield* getOne(adapterId) : undefined;
            // Ensure — create when missing; a ConflictException means another
            // writer won the race, so fall through to the name lookup.
            if (!observed) {
                const created = yield* throttleRetry(textract.createAdapter({
                    AdapterName: name,
                    FeatureTypes: news.featureTypes,
                    Description: news.description,
                    AutoUpdate: news.autoUpdate,
                    Tags: desiredTags,
                })).pipe(Effect.catchTag("ConflictException", () => Effect.succeed(undefined)));
                adapterId = created?.AdapterId ?? (yield* findByName(name));
                if (!adapterId) {
                    return yield* Effect.die(new Error(`Textract adapter ${name} was neither created nor found`));
                }
                observed = yield* getOne(adapterId);
            }
            yield* session.note(adapterId);
            const arn = yield* adapterArn(adapterId);
            // Sync mutable settings — diff observed against desired and apply
            // only the delta. UpdateAdapter treats omitted fields as unchanged.
            const update = {
                AdapterId: adapterId,
            };
            let dirty = false;
            if (observed?.AdapterName !== name) {
                update.AdapterName = name;
                dirty = true;
            }
            if (news.description !== undefined &&
                observed?.Description !== news.description) {
                update.Description = news.description;
                dirty = true;
            }
            if (news.autoUpdate !== undefined &&
                observed?.AutoUpdate !== news.autoUpdate) {
                update.AutoUpdate = news.autoUpdate;
                dirty = true;
            }
            if (dirty) {
                yield* throttleRetry(textract.updateAdapter(update));
            }
            // Sync tags — diff against the OBSERVED cloud tags (adoption may
            // hand us foreign tags), not olds/output.
            const { removed, upsert } = diffTags(normalizeTags(observed?.Tags), desiredTags);
            if (upsert.length > 0) {
                yield* throttleRetry(textract.tagResource({
                    ResourceARN: arn,
                    Tags: Object.fromEntries(upsert.map((t) => [t.Key, t.Value])),
                }));
            }
            if (removed.length > 0) {
                yield* throttleRetry(textract.untagResource({
                    ResourceARN: arn,
                    TagKeys: removed,
                }));
            }
            const final = yield* getOne(adapterId);
            return toAttributes(arn, final ?? { AdapterId: adapterId, AdapterName: name });
        }),
        delete: Effect.fn(function* ({ output }) {
            // Idempotent — the adapter may already be gone.
            yield* throttleRetry(textract.deleteAdapter({ AdapterId: output.adapterId })).pipe(Effect.catchTag("ResourceNotFoundException", () => Effect.void));
        }),
    };
}));
//# sourceMappingURL=Adapter.js.map