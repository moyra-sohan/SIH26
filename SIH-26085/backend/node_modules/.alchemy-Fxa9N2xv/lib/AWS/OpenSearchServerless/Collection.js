import * as aoss from "@distilled.cloud/aws/opensearchserverless";
import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";
import { Unowned } from "../../AdoptPolicy.js";
import { isResolved } from "../../Diff.js";
import { createPhysicalName } from "../../PhysicalName.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
import { createInternalTags, diffTags, hasAlchemyTags } from "../../Tags.js";
import { awaitCollectionActive, recordToTagList, retryWhileConflict, tagsToRecord, } from "./internal.js";
/**
 * An Amazon OpenSearch Serverless collection — a group of OpenSearch indexes
 * that scales OpenSearch Compute Units (OCUs) automatically. A collection of
 * type `VECTORSEARCH` is the vector store required to back an Amazon Bedrock
 * Knowledge Base.
 *
 * A collection requires a matching encryption {@link SecurityPolicy} to exist
 * before creation, plus a network security policy and a data
 * {@link AccessPolicy} to be reachable and usable. Creation is asynchronous —
 * the provider polls (bounded, ~5 minutes) until the collection reaches
 * `ACTIVE`.
 *
 * ### Creating Collections
 * **Example:** Vector Search Collection for a Bedrock Knowledge Base
 * ```typescript
 * import * as AWS from "alchemy/AWS";
 *
 * const encryption = yield* AWS.OpenSearchServerless.SecurityPolicy("Enc", {
 *   policyName: "kb-enc",
 *   type: "encryption",
 *   policy: {
 *     Rules: [{ ResourceType: "collection", Resource: ["collection/kb"] }],
 *     AWSOwnedKey: true,
 *   },
 * });
 * const network = yield* AWS.OpenSearchServerless.SecurityPolicy("Net", {
 *   policyName: "kb-net",
 *   type: "network",
 *   policy: [
 *     {
 *       Rules: [
 *         { ResourceType: "collection", Resource: ["collection/kb"] },
 *         { ResourceType: "dashboard", Resource: ["collection/kb"] },
 *       ],
 *       AllowFromPublic: true,
 *     },
 *   ],
 * });
 * const collection = yield* AWS.OpenSearchServerless.Collection("KB", {
 *   collectionName: "kb",
 *   type: "VECTORSEARCH",
 * });
 * // collection.collectionEndpoint is the aoss data-plane endpoint
 * ```
 *
 * ### Search Collections
 * **Example:** Simple Search Collection
 * ```typescript
 * const collection = yield* AWS.OpenSearchServerless.Collection("Search", {
 *   collectionName: "logs",
 *   type: "SEARCH",
 *   description: "application logs",
 * });
 * ```
 *
 * @resource
 */
export const Collection = Resource("AWS.OpenSearchServerless.Collection");
export const CollectionProvider = () => Provider.effect(Collection, Effect.gen(function* () {
    const createName = Effect.fn(function* (id, props) {
        return (props.collectionName ??
            (yield* createPhysicalName({ id, maxLength: 32, lowercase: true })));
    });
    const toAttributes = (detail) => ({
        collectionId: detail.id,
        collectionName: detail.name,
        collectionArn: detail.arn,
        type: detail.type,
        status: detail.status,
        kmsKeyArn: detail.kmsKeyArn,
        collectionEndpoint: detail.collectionEndpoint,
        dashboardEndpoint: detail.dashboardEndpoint,
    });
    const observeByName = Effect.fn(function* (name) {
        const response = yield* aoss.batchGetCollection({ names: [name] });
        return response.collectionDetails?.[0];
    });
    const syncTags = Effect.fn(function* (arn, desired) {
        const observed = yield* aoss
            .listTagsForResource({ resourceArn: arn })
            .pipe(Effect.map((r) => tagsToRecord(r.tags)));
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
    return Collection.Provider.of({
        stables: ["collectionId", "collectionName", "collectionArn"],
        list: () => Effect.gen(function* () {
            const pages = yield* aoss.listCollections
                .pages({})
                .pipe(Stream.runCollect);
            return Array.from(pages)
                .flatMap((page) => page.collectionSummaries ?? [])
                .filter((s) => s.id !== undefined &&
                s.name !== undefined &&
                s.arn !== undefined)
                .map((s) => ({
                collectionId: s.id,
                collectionName: s.name,
                collectionArn: s.arn,
                status: s.status,
                kmsKeyArn: s.kmsKeyArn,
            }));
        }),
        read: Effect.fn(function* ({ id, olds, output }) {
            const name = output?.collectionName ?? (yield* createName(id, olds ?? {}));
            const detail = yield* observeByName(name);
            if (detail?.id === undefined || detail.arn === undefined) {
                return undefined;
            }
            const attrs = toAttributes(detail);
            const tags = yield* aoss
                .listTagsForResource({ resourceArn: detail.arn })
                .pipe(Effect.map((r) => r.tags), Effect.catch(() => Effect.succeed(undefined)));
            return (yield* hasAlchemyTags(id, (tags ?? []).map((t) => ({ Key: t.key, Value: t.value }))))
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
            if ((olds.type ?? "SEARCH") !== (news.type ?? "SEARCH")) {
                return { action: "replace" };
            }
            // description/deletionProtection/tags fall through to update
        }),
        reconcile: Effect.fn(function* ({ id, news, output, session }) {
            const name = output?.collectionName ?? (yield* createName(id, news));
            const type = news.type ?? "SEARCH";
            const internalTags = yield* createInternalTags(id);
            const desiredTags = { ...news.tags, ...internalTags };
            // 1. OBSERVE — cloud state is authoritative
            let detail = yield* observeByName(name);
            // 2. ENSURE — create if missing; wait for ACTIVE (async provisioning)
            if (detail === undefined) {
                const created = yield* aoss
                    .createCollection({
                    name,
                    type,
                    description: news.description,
                    standbyReplicas: news.standbyReplicas,
                    deletionProtection: news.deletionProtection,
                    tags: recordToTagList(desiredTags),
                })
                    .pipe(Effect.map((r) => r.createCollectionDetail), 
                // a concurrent reconciler already created it — fall through
                Effect.catchTag("ConflictException", () => Effect.succeed(undefined)));
                const collectionId = created?.id ?? (yield* observeByName(name))?.id;
                if (collectionId === undefined) {
                    return yield* Effect.fail(new aoss.ResourceNotFoundException({
                        message: `collection ${name} not visible after create`,
                    }));
                }
                yield* session.note(`creating collection ${name} (async)...`);
                detail = yield* awaitCollectionActive(collectionId);
            }
            else if (detail.status !== "ACTIVE") {
                detail = yield* awaitCollectionActive(detail.id);
            }
            // 3. SYNC — description (deletionProtection updates alongside)
            const descriptionDrift = news.description !== undefined &&
                news.description !== detail.description;
            const protectionDrift = news.deletionProtection !== undefined &&
                news.deletionProtection !== detail.deletionProtection;
            if (descriptionDrift || protectionDrift) {
                yield* aoss.updateCollection({
                    id: detail.id,
                    description: descriptionDrift ? news.description : undefined,
                    deletionProtection: protectionDrift
                        ? news.deletionProtection
                        : undefined,
                });
            }
            // 3b. SYNC TAGS — diff against observed cloud tags
            yield* syncTags(detail.arn, desiredTags);
            yield* session.note(detail.id);
            return toAttributes(detail);
        }),
        delete: Effect.fn(function* ({ output }) {
            yield* retryWhileConflict(aoss.deleteCollection({ id: output.collectionId })).pipe(Effect.catchTag("ResourceNotFoundException", () => Effect.void));
        }),
    });
}));
//# sourceMappingURL=Collection.js.map