import * as aoss from "@distilled.cloud/aws/opensearchserverless";
import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";
import { Unowned } from "../../AdoptPolicy.js";
import { isResolved } from "../../Diff.js";
import { createPhysicalName } from "../../PhysicalName.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
import { createInternalTags, diffTags, hasAlchemyTags } from "../../Tags.js";
import { recordToTagList, retryWhileConflict, tagsToRecord, } from "./internal.js";
/**
 * An Amazon OpenSearch Serverless collection group. Collection groups manage
 * OpenSearch Compute Units (OCUs) at a group level — multiple collections
 * share the group's capacity limits instead of each collection scaling
 * independently.
 *
 * ### Creating Collection Groups
 * **Example:** Capacity-Bounded Collection Group
 * ```typescript
 * import * as AWS from "alchemy/AWS";
 *
 * const group = yield* AWS.OpenSearchServerless.CollectionGroup("Group", {
 *   groupName: "analytics",
 *   standbyReplicas: "DISABLED",
 *   capacityLimits: {
 *     maxIndexingCapacityInOCU: 4,
 *     maxSearchCapacityInOCU: 4,
 *   },
 * });
 * ```
 *
 * @resource
 */
export const CollectionGroup = Resource("AWS.OpenSearchServerless.CollectionGroup");
export const CollectionGroupProvider = () => Provider.effect(CollectionGroup, Effect.gen(function* () {
    const createName = Effect.fn(function* (id, props) {
        return (props.groupName ??
            (yield* createPhysicalName({ id, maxLength: 32, lowercase: true })));
    });
    const toAttributes = (detail) => ({
        collectionGroupId: detail.id,
        collectionGroupName: detail.name,
        collectionGroupArn: detail.arn,
        standbyReplicas: detail.standbyReplicas,
        numberOfCollections: detail.numberOfCollections,
        generation: detail.generation,
    });
    // batchGetCollectionGroup reports a missing group in
    // collectionGroupErrorDetails instead of failing.
    const observeByName = Effect.fn(function* (name) {
        const response = yield* aoss.batchGetCollectionGroup({
            names: [name],
        });
        return response.collectionGroupDetails?.[0];
    });
    const capacityDrift = (desired, observed) => desired !== undefined &&
        (desired.maxIndexingCapacityInOCU !==
            observed?.maxIndexingCapacityInOCU ||
            desired.maxSearchCapacityInOCU !== observed?.maxSearchCapacityInOCU ||
            desired.minIndexingCapacityInOCU !==
                observed?.minIndexingCapacityInOCU ||
            desired.minSearchCapacityInOCU !== observed?.minSearchCapacityInOCU);
    // batchGetCollectionGroup does not return the group's tags — read them
    // via listTagsForResource (the authoritative tag store).
    const observeTags = Effect.fn(function* (arn) {
        return yield* aoss
            .listTagsForResource({ resourceArn: arn })
            .pipe(Effect.map((r) => tagsToRecord(r.tags)));
    });
    const syncTags = Effect.fn(function* (arn, observed, desired) {
        const { upsert, removed } = diffTags(observed, desired);
        if (upsert.length > 0) {
            yield* aoss.tagResource({
                resourceArn: arn,
                tags: recordToTagList(Object.fromEntries(upsert.map((t) => [t.Key, t.Value]))),
            });
        }
        if (removed.length > 0) {
            yield* aoss.untagResource({ resourceArn: arn, tagKeys: removed });
        }
    });
    return CollectionGroup.Provider.of({
        stables: [
            "collectionGroupId",
            "collectionGroupName",
            "collectionGroupArn",
        ],
        list: () => Effect.gen(function* () {
            const pages = yield* aoss.listCollectionGroups
                .pages({})
                .pipe(Stream.runCollect);
            return Array.from(pages)
                .flatMap((page) => page.collectionGroupSummaries ?? [])
                .filter((s) => s.id !== undefined &&
                s.name !== undefined &&
                s.arn !== undefined)
                .map((s) => ({
                collectionGroupId: s.id,
                collectionGroupName: s.name,
                collectionGroupArn: s.arn,
                generation: s.generation,
            }));
        }),
        read: Effect.fn(function* ({ id, olds, output }) {
            const name = output?.collectionGroupName ?? (yield* createName(id, olds ?? {}));
            const detail = yield* observeByName(name);
            if (detail?.id === undefined || detail.arn === undefined) {
                return undefined;
            }
            const attrs = toAttributes(detail);
            const tags = yield* observeTags(detail.arn).pipe(Effect.catch(() => Effect.succeed({})));
            return (yield* hasAlchemyTags(id, Object.entries(tags).map(([Key, Value]) => ({ Key, Value }))))
                ? attrs
                : Unowned(attrs);
        }),
        diff: Effect.fn(function* ({ id, news, olds }) {
            if (!isResolved(news))
                return undefined;
            const oldName = yield* createName(id, olds);
            const newName = yield* createName(id, news);
            if (oldName !== newName) {
                return { action: "replace" };
            }
            if (olds.standbyReplicas !== undefined &&
                news.standbyReplicas !== undefined &&
                olds.standbyReplicas !== news.standbyReplicas) {
                return { action: "replace" };
            }
            // description/capacityLimits/tags fall through to update
        }),
        reconcile: Effect.fn(function* ({ id, news, output, session }) {
            const name = output?.collectionGroupName ?? (yield* createName(id, news));
            const internalTags = yield* createInternalTags(id);
            const desiredTags = { ...news.tags, ...internalTags };
            // 1. OBSERVE — cloud state is authoritative
            let detail = yield* observeByName(name);
            // 2. ENSURE — create if missing; tolerate a concurrent create race
            if (detail === undefined) {
                const created = yield* aoss
                    .createCollectionGroup({
                    name,
                    standbyReplicas: news.standbyReplicas ?? "ENABLED",
                    description: news.description,
                    capacityLimits: news.capacityLimits,
                    tags: recordToTagList(desiredTags),
                })
                    .pipe(Effect.map((r) => r.createCollectionGroupDetail), Effect.catchTag("ConflictException", () => Effect.succeed(undefined)));
                detail =
                    created !== undefined
                        ? { ...created }
                        : yield* observeByName(name);
            }
            else {
                // 3. SYNC — description/capacityLimits when observed drifts
                const descriptionDrift = news.description !== undefined &&
                    news.description !== detail.description;
                const limitsDrift = capacityDrift(news.capacityLimits, detail.capacityLimits);
                if (descriptionDrift || limitsDrift) {
                    yield* aoss.updateCollectionGroup({
                        id: detail.id,
                        description: descriptionDrift ? news.description : undefined,
                        capacityLimits: limitsDrift ? news.capacityLimits : undefined,
                    });
                }
            }
            if (detail?.id === undefined || detail.arn === undefined) {
                return yield* Effect.fail(new aoss.ResourceNotFoundException({
                    message: `collection group ${name} not visible after reconcile`,
                }));
            }
            // 3b. SYNC TAGS — diff against observed cloud tags (read via
            // listTagsForResource on every path: adoption may bring foreign
            // tags, and a create race may have dropped ours).
            yield* syncTags(detail.arn, yield* observeTags(detail.arn), desiredTags);
            yield* session.note(detail.id);
            return toAttributes(detail);
        }),
        delete: Effect.fn(function* ({ output }) {
            // A group with collections still in it (or tearing down) surfaces
            // ConflictException — retry through the teardown window.
            yield* retryWhileConflict(aoss.deleteCollectionGroup({ id: output.collectionGroupId })).pipe(Effect.catchTag("ResourceNotFoundException", () => Effect.void));
        }),
    });
}));
//# sourceMappingURL=CollectionGroup.js.map