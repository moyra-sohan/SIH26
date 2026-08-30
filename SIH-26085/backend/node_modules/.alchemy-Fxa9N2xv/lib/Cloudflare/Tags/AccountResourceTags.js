import * as resourceTagging from "@distilled.cloud/cloudflare/resource-tagging";
import * as Effect from "effect/Effect";
import * as Predicate from "effect/Predicate";
import * as Stream from "effect/Stream";
import { Unowned } from "../../AdoptPolicy.js";
import { isResolved } from "../../Diff.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
import { recordsEqual } from "../../Util/equal.js";
import { CloudflareEnvironment } from "../CloudflareEnvironment.js";
const TypeId = "Cloudflare.Tags.AccountResourceTags";
/**
 * Key/value tags attached to an account-level Cloudflare resource via the
 * unified resource-tagging API (open beta).
 *
 * The tag SET is the resource: `PUT` replaces the full set, and deleting
 * this resource clears every tag from the target. Cloudflare reports an
 * untagged (or unknown) resource as an empty tag set rather than a 404, so
 * an empty set is treated as "absent".
 *
 * Safety: tags carry no ownership markers. On a cold read (no prior state)
 * a non-empty tag set on the target resource is reported as `Unowned`, and
 * the engine refuses to take it over (i.e. clobber the existing tags)
 * unless `--adopt` or `adopt(true)` is set.
 * ### Tagging a resource
 * **Example:** Tag a KV namespace
 * ```typescript
 * const kv = yield* Cloudflare.KV.Namespace("cache", {});
 *
 * yield* Cloudflare.Tags.AccountResourceTags("cache-tags", {
 *   resourceType: "kv_namespace",
 *   resourceId: kv.namespaceId,
 *   tags: { team: "platform", env: "production" },
 * });
 * ```
 *
 * **Example:** Tag the account itself
 * ```typescript
 * yield* Cloudflare.Tags.AccountResourceTags("account-tags", {
 *   resourceType: "account",
 *   resourceId: accountId,
 *   tags: { "cost-center": "eng-42" },
 * });
 * ```
 *
 * @see https://developers.cloudflare.com/fundamentals/account/tags/
 *
 * @resource
 * @product Resource Tagging
 * @category Account & Identity
 */
export const AccountResourceTags = Resource(TypeId);
/**
 * Returns true if the given value is an AccountResourceTags resource.
 */
export const isAccountResourceTags = (value) => Predicate.hasProperty(value, "Type") && value.Type === TypeId;
export const AccountResourceTagsProvider = () => Provider.succeed(AccountResourceTags, {
    stables: ["accountId", "resourceType", "resourceId", "workerId"],
    // Account-wide enumeration: `GET /accounts/{id}/tags/resources` returns
    // every tagged resource in the account, so the tag set of each is directly
    // hydratable into the `read` Attributes shape.
    list: Effect.fn(function* () {
        const { accountId } = yield* yield* CloudflareEnvironment;
        return yield* resourceTagging.listResourceTaggings
            .pages({ accountId })
            .pipe(Stream.runCollect, Effect.map((chunk) => Array.from(chunk).flatMap((page) => (page.result ?? []).map((item) => ({
            accountId,
            resourceType: item.type,
            resourceId: item.id,
            workerId: "workerId" in item ? item.workerId : undefined,
            tags: narrowTags(item.tags),
            etag: item.etag,
        })))));
    }),
    diff: Effect.fn(function* ({ olds = {}, news }) {
        const o = olds;
        const n = news;
        if (o.resourceType !== undefined && o.resourceType !== n.resourceType) {
            return { action: "replace" };
        }
        // resourceId / workerId are Input<string>; by diff time persisted
        // olds are concrete strings — compare only when both sides are.
        if (typeof o.resourceId === "string" &&
            typeof n.resourceId === "string" &&
            o.resourceId !== n.resourceId) {
            return { action: "replace" };
        }
        if (typeof o.workerId === "string" &&
            typeof n.workerId === "string" &&
            o.workerId !== n.workerId) {
            return { action: "replace" };
        }
    }),
    read: Effect.fn(function* ({ output, olds }) {
        const { accountId } = yield* yield* CloudflareEnvironment;
        const acct = output?.accountId ?? accountId;
        // At plan time `olds` may still hold unresolved Output proxies (e.g.
        // an adoption pre-check before the referenced resource deploys) —
        // only fall back to them once resolved.
        const resolvedOlds = olds !== undefined && isResolved(olds) ? olds : undefined;
        const resourceId = output?.resourceId ?? resolvedOlds?.resourceId;
        const resourceType = output?.resourceType ?? resolvedOlds?.resourceType;
        const workerId = output?.workerId ?? resolvedOlds?.workerId;
        if (!resourceId || !resourceType)
            return undefined;
        const observed = yield* resourceTagging.getAccountTag({
            accountId: acct,
            resourceId,
            resourceType,
            workerId,
        });
        const tags = narrowTags(observed.tags);
        // Cloudflare reports untagged (and unknown) resources as an empty
        // tag set — that is "gone" for this resource.
        if (Object.keys(tags).length === 0)
            return undefined;
        const attrs = {
            accountId: acct,
            resourceType,
            resourceId,
            workerId,
            tags,
            etag: observed.etag,
        };
        // Cold read without prior state: a non-empty tag set exists but we
        // cannot prove we created it (tags carry no ownership markers), so
        // gate takeover behind the adopt policy.
        return output ? attrs : Unowned(attrs);
    }),
    reconcile: Effect.fn(function* ({ news, output }) {
        const { accountId } = yield* yield* CloudflareEnvironment;
        const acct = output?.accountId ?? accountId;
        // Inputs have been resolved to concrete strings by Plan.
        const resourceId = news.resourceId;
        const workerId = news.workerId;
        const desired = resolveTags(news.tags);
        // Observe — cloud state is authoritative. The GET never 404s for a
        // missing/untagged resource; it returns an empty tag set, so the
        // same call covers greenfield, update, and adoption.
        const observed = yield* resourceTagging.getAccountTag({
            accountId: acct,
            resourceId,
            resourceType: news.resourceType,
            workerId,
        });
        // Sync — PUT is a full replace, so the only decision is whether the
        // observed set already equals the desired set (skip the write).
        if (recordsEqual(narrowTags(observed.tags), desired)) {
            return {
                accountId: acct,
                resourceType: news.resourceType,
                resourceId,
                workerId,
                tags: desired,
                etag: observed.etag,
            };
        }
        const updated = yield* resourceTagging.putAccountTag({
            accountId: acct,
            resourceId,
            resourceType: news.resourceType,
            workerId,
            tags: desired,
        });
        return {
            accountId: acct,
            resourceType: news.resourceType,
            resourceId,
            workerId,
            tags: narrowTags(updated.tags),
            etag: updated.etag,
        };
    }),
    delete: Effect.fn(function* ({ output }) {
        // The DELETE endpoint is idempotent — Cloudflare returns 204 even
        // for resources that were never tagged.
        yield* resourceTagging.deleteAccountTag({
            accountId: output.accountId,
            resourceId: output.resourceId,
            resourceType: output.resourceType,
            workerId: output.workerId,
        });
    }),
});
/** Narrow distilled's `Record<string, unknown>` tag values to strings. */
const narrowTags = (tags) => Object.fromEntries(Object.entries(tags).map(([k, v]) => [k, String(v)]));
/** Resolve `Input<string>` tag values (already concrete after Plan). */
const resolveTags = (tags) => Object.fromEntries(Object.entries(tags).map(([k, v]) => [k, v]));
//# sourceMappingURL=AccountResourceTags.js.map