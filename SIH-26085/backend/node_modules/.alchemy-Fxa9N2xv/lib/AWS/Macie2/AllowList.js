import * as macie2 from "@distilled.cloud/aws/macie2";
import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";
import { Unowned } from "../../AdoptPolicy.js";
import { createPhysicalName } from "../../PhysicalName.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
import { createInternalTags, diffTags, hasAlchemyTags, tagRecord, } from "../../Tags.js";
import { retryThroughEnablement } from "./common.js";
/**
 * An Amazon Macie allow list — text patterns or predefined words that Macie
 * ignores when it inspects S3 objects for sensitive data. Requires Macie to be
 * enabled for the account (see `Macie2.Session`). Name, description, and
 * criteria are all updatable in place; destroy deletes the list even if
 * classification jobs reference it.
 *
 * ### Creating an allow list
 * **Example:** Regex allow list
 * ```typescript
 * const allowList = yield* Macie2.AllowList("InternalIds", {
 *   description: "Internal ticket ids are not sensitive",
 *   criteria: { regex: "TICKET-[0-9]{6}" },
 * });
 * ```
 *
 * **Example:** Predefined words from S3
 * ```typescript
 * const allowList = yield* Macie2.AllowList("KnownTestData", {
 *   criteria: {
 *     s3WordsList: { bucketName: bucket.bucketName, objectKey: "words.txt" },
 *   },
 * });
 * ```
 */
const AllowListResource = Resource("AWS.Macie2.AllowList");
export { AllowListResource as AllowList };
const createName = (id, props) => props.name
    ? Effect.succeed(props.name)
    : createPhysicalName({ id, maxLength: 128 });
const buildAllowListAttrs = (id, live) => ({
    id,
    arn: live.arn,
    name: live.name,
    status: live.status?.code,
});
export const AllowListProvider = () => Provider.effect(AllowListResource, Effect.gen(function* () {
    const getAllowList = (id) => macie2.getAllowList({ id }).pipe(Effect.catchTag("ResourceNotFoundException", () => Effect.succeed(undefined)), 
    // Macie disabled ⇒ the list is unreachable (and disabling deletes
    // all Macie configuration), so report it as gone.
    Effect.catchTag("AccessDeniedException", () => Effect.succeed(undefined)));
    return {
        stables: ["id", "arn"],
        read: Effect.fn(function* ({ id, output }) {
            if (!output?.id)
                return undefined;
            const live = yield* getAllowList(output.id);
            if (!live)
                return undefined;
            const attrs = buildAllowListAttrs(output.id, live);
            return (yield* hasAlchemyTags(id, live.tags))
                ? attrs
                : Unowned(attrs);
        }),
        list: () => Effect.gen(function* () {
            const pages = yield* macie2.listAllowLists.pages({}).pipe(Stream.runCollect, Effect.catchTag("AccessDeniedException", () => Effect.succeed([])));
            const out = [];
            for (const page of pages) {
                for (const summary of page.allowLists ?? []) {
                    const live = yield* getAllowList(summary.id);
                    if (live)
                        out.push(buildAllowListAttrs(summary.id, live));
                }
            }
            return out;
        }),
        reconcile: Effect.fn(function* ({ id, news, output, session }) {
            const internalTags = yield* createInternalTags(id);
            const desiredTags = { ...news.tags, ...internalTags };
            const name = news.name ?? (yield* createName(id, news));
            // 1. OBSERVE — cloud state is authoritative; output caches the id.
            let allowListId = output?.id;
            let live = allowListId ? yield* getAllowList(allowListId) : undefined;
            if (!live || allowListId === undefined) {
                // 2. ENSURE — create the allow list (retry through enablement lag).
                const created = yield* retryThroughEnablement(macie2.createAllowList({
                    name,
                    description: news.description,
                    criteria: news.criteria,
                    tags: desiredTags,
                }));
                allowListId = created.id;
            }
            else {
                // 3. SYNC settings — observed ↔ desired (name is required by the
                // update API, so it is always sent when anything drifts).
                const drift = live.name !== name ||
                    (news.description !== undefined &&
                        live.description !== news.description) ||
                    JSON.stringify(live.criteria) !== JSON.stringify(news.criteria);
                if (drift) {
                    yield* macie2.updateAllowList({
                        id: allowListId,
                        name,
                        description: news.description,
                        criteria: news.criteria,
                    });
                }
                // 3b. SYNC tags — diff against OBSERVED cloud tags.
                const { upsert, removed } = diffTags(tagRecord(live.tags), desiredTags);
                if (upsert.length > 0) {
                    yield* macie2.tagResource({
                        resourceArn: live.arn,
                        tags: Object.fromEntries(upsert.map((t) => [t.Key, t.Value])),
                    });
                }
                if (removed.length > 0) {
                    yield* macie2.untagResource({
                        resourceArn: live.arn,
                        tagKeys: removed,
                    });
                }
            }
            // 4. RETURN fresh attributes.
            const final = yield* macie2.getAllowList({ id: allowListId });
            yield* session.note(allowListId);
            return buildAllowListAttrs(allowListId, final);
        }),
        delete: Effect.fn(function* ({ output }) {
            // Idempotent — the list may already be gone, or Macie may already be
            // disabled for the account (which removes all Macie configuration).
            yield* macie2
                .deleteAllowList({ id: output.id, ignoreJobChecks: "true" })
                .pipe(Effect.catchTag("ResourceNotFoundException", () => Effect.void), Effect.catchTag("AccessDeniedException", () => Effect.void));
        }),
    };
}));
//# sourceMappingURL=AllowList.js.map