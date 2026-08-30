import * as ddos from "@distilled.cloud/cloudflare/ddos-protection";
import * as Effect from "effect/Effect";
import * as Predicate from "effect/Predicate";
import * as Stream from "effect/Stream";
import { Unowned } from "../../AdoptPolicy.js";
import { isResolved } from "../../Diff.js";
import { createPhysicalName } from "../../PhysicalName.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
import { CloudflareEnvironment } from "../CloudflareEnvironment.js";
const TypeId = "Cloudflare.DdosProtection.AllowlistEntry";
/**
 * An Advanced TCP Protection allowlist entry (Magic Transit).
 *
 * Traffic from an allowlisted prefix bypasses Advanced TCP Protection
 * entirely. An entry's identity is its `prefix` — only `comment` and
 * `enabled` are mutable in place; changing the prefix triggers a
 * replacement.
 *
 * Requires the **Magic Transit / Advanced TCP Protection** entitlement; on
 * accounts without it every API call fails with the typed
 * `AdvancedTcpProtectionNotEntitled` error.
 *
 * Safety: allowlist entries carry no ownership markers. When there is no
 * prior state, `read` scans for an existing entry with the same prefix and
 * reports it as `Unowned`, so the engine refuses to take it over unless
 * `--adopt` (or `adopt(true)`) is set.
 * ### Creating an allowlist entry
 * **Example:** Allowlist a trusted prefix
 * ```typescript
 * const entry = yield* Cloudflare.DdosProtection.DdosAllowlistEntry("OfficeEgress", {
 *   prefix: "192.0.2.0/24",
 *   enabled: true,
 * });
 * ```
 *
 * **Example:** Staged entry with an explicit comment
 * ```typescript
 * // `enabled: false` keeps the entry inert until you flip it on.
 * yield* Cloudflare.DdosProtection.DdosAllowlistEntry("PartnerRange", {
 *   prefix: "198.51.100.0/24",
 *   comment: "partner NAT range — enable during migration",
 *   enabled: false,
 * });
 * ```
 *
 * @see https://developers.cloudflare.com/ddos-protection/advanced-ddos-systems/overview/advanced-tcp-protection/
 *
 * @resource
 * @product DDoS Protection
 * @category Network
 */
export const DdosAllowlistEntry = Resource(TypeId);
/**
 * Returns true if the given value is a DdosAllowlistEntry resource.
 */
export const isDdosAllowlistEntry = (value) => Predicate.hasProperty(value, "Type") && value.Type === TypeId;
export const DdosAllowlistEntryProvider = () => Provider.succeed(DdosAllowlistEntry, {
    stables: ["allowlistId", "accountId", "prefix", "createdOn"],
    diff: Effect.fn(function* ({ olds, news }) {
        if (olds === undefined)
            return undefined;
        // `news` runs at plan time and may still carry unresolved
        // expressions — bail out and let the engine apply default logic.
        if (!isResolved(news))
            return undefined;
        // The API only patches comment/enabled — the prefix is the entry's
        // identity and cannot change.
        if (olds.prefix !== news.prefix) {
            return { action: "replace" };
        }
        return undefined;
    }),
    read: Effect.fn(function* ({ output, olds }) {
        const { accountId } = yield* yield* CloudflareEnvironment;
        const acct = output?.accountId ?? accountId;
        // Owned path: refresh by our persisted allowlist id.
        if (output?.allowlistId) {
            const observed = yield* getEntry(acct, output.allowlistId);
            if (observed)
                return toAttributes(observed, acct);
        }
        // Adoption path: an entry for this prefix may already exist.
        // Allowlist entries carry no ownership markers, so brand the match
        // `Unowned` — the engine refuses to take over unless `adopt` is set.
        const prefix = output?.prefix ?? olds?.prefix;
        if (prefix) {
            const observed = yield* findByPrefix(acct, prefix);
            if (observed)
                return Unowned(toAttributes(observed, acct));
        }
        return undefined;
    }),
    reconcile: Effect.fn(function* ({ id, news, output }) {
        const { accountId } = yield* yield* CloudflareEnvironment;
        const comment = news.comment ?? (yield* createPhysicalName({ id, lowercase: true }));
        const enabled = news.enabled ?? false;
        // 1. Observe — the allowlist id cached on `output` is a hint, not a
        //    guarantee: a missing entry falls through to the prefix scan and
        //    then to create.
        let observed = output?.allowlistId
            ? yield* getEntry(accountId, output.allowlistId)
            : undefined;
        // 2. Fall back to scanning for the prefix match (ownership was
        //    already gated by `read` reporting existing entries as Unowned).
        if (!observed) {
            observed = yield* findByPrefix(accountId, news.prefix);
        }
        // 3. Ensure — create when missing.
        if (!observed) {
            observed = yield* ddos.createAdvancedTcpProtectionAllowlist({
                accountId,
                prefix: news.prefix,
                comment,
                enabled,
            });
        }
        // 4. Sync — diff observed comment/enabled against desired; skip the
        //    patch entirely on a no-op.
        const dirty = observed.comment !== comment || observed.enabled !== enabled;
        if (dirty) {
            observed = yield* ddos.patchAdvancedTcpProtectionAllowlistItem({
                accountId,
                prefixId: observed.id,
                comment,
                enabled,
            });
        }
        return toAttributes(observed, accountId);
    }),
    delete: Effect.fn(function* ({ output }) {
        yield* ddos
            .deleteAdvancedTcpProtectionAllowlistItem({
            accountId: output.accountId,
            prefixId: output.allowlistId,
        })
            .pipe(Effect.catchTag("AllowlistEntryNotFound", () => Effect.void));
    }),
    list: Effect.fn(function* () {
        const { accountId } = yield* yield* CloudflareEnvironment;
        return yield* ddos.listAdvancedTcpProtectionAllowlists
            .pages({ accountId })
            .pipe(Stream.runCollect, Effect.map((chunk) => Array.from(chunk).flatMap((page) => (page.result ?? []).map((entry) => toAttributes(entry, accountId)))), 
        // Accounts without the Magic Transit / Advanced TCP Protection
        // entitlement cannot enumerate allowlist entries — there is
        // provably nothing to list, so return an empty array.
        Effect.catchTag("AdvancedTcpProtectionNotEntitled", () => Effect.succeed([])));
    }),
});
/**
 * Read an allowlist entry by id, mapping "gone" (`AllowlistEntryNotFound`,
 * HTTP 404) to `undefined`.
 */
const getEntry = (accountId, prefixId) => ddos.getAdvancedTcpProtectionAllowlistItem({ accountId, prefixId }).pipe(Effect.map((entry) => entry), Effect.catchTag("AllowlistEntryNotFound", () => Effect.succeed(undefined)));
/**
 * Find an allowlist entry by exact prefix. If several entries carry the
 * same prefix, pick the oldest for determinism.
 */
const findByPrefix = (accountId, prefix) => ddos.listAdvancedTcpProtectionAllowlists.items({ accountId }).pipe(Stream.runCollect, Effect.map((chunk) => Array.from(chunk)
    .filter((entry) => entry.prefix === prefix)
    .sort((a, b) => a.createdOn.localeCompare(b.createdOn))
    .at(0)));
const toAttributes = (entry, accountId) => ({
    allowlistId: entry.id,
    accountId,
    prefix: entry.prefix,
    comment: entry.comment,
    enabled: entry.enabled,
    createdOn: entry.createdOn,
    modifiedOn: entry.modifiedOn,
});
//# sourceMappingURL=AllowlistEntry.js.map