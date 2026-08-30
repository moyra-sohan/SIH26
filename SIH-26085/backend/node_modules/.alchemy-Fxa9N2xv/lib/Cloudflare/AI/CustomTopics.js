import * as aiSecurity from "@distilled.cloud/cloudflare/ai-security";
import * as Effect from "effect/Effect";
import * as Predicate from "effect/Predicate";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
import { CloudflareEnvironment } from "../CloudflareEnvironment.js";
import { listAllZones } from "../Zone/lookup.js";
const TypeId = "Cloudflare.AI.Security.CustomTopics";
/**
 * Custom topic categories for AI Security for Apps (Firewall for AI)
 * content detection on a Cloudflare zone
 * (`/zones/{zone_id}/ai-security/custom-topics`).
 *
 * The topic list is a zone singleton — it always exists (defaulting to
 * empty) and is never created or deleted, only replaced wholesale via
 * PUT. Reconcile PUTs the desired list when the observed list differs;
 * destroy restores the list the zone had before Alchemy first managed it.
 *
 * Declare at most one `CustomTopics` per zone — two instances
 * managing the same zone would fight over the single underlying list.
 *
 * AI Security for Apps is entitlement-gated: on accounts without the
 * feature every call fails with the typed `AiSecurityNotEntitled` error
 * (Cloudflare error code 13101).
 * ### Managing custom topics
 * **Example:** Classify traffic into two custom topics
 * ```typescript
 * const topics = yield* Cloudflare.AI.CustomTopics("Topics", {
 *   zoneId: zone.zoneId,
 *   topics: [
 *     { label: "billing", topic: "Questions about invoices and payments" },
 *     { label: "abuse", topic: "Harassment or abusive language" },
 *   ],
 * });
 * ```
 *
 * **Example:** Clear all custom topics
 * ```typescript
 * yield* Cloudflare.AI.CustomTopics("Topics", {
 *   zoneId: zone.zoneId,
 *   topics: [],
 * });
 * ```
 *
 * @see https://developers.cloudflare.com/waf/detections/firewall-for-ai/
 *
 * @resource
 * @product AI Security
 * @category Application Security
 */
export const CustomTopics = Resource(TypeId, {
    aliases: ["Cloudflare.AiSecurity.CustomTopics"],
});
/**
 * Returns true if the given value is a CustomTopics resource.
 */
export const isCustomTopics = (value) => Predicate.hasProperty(value, "Type") && value.Type === TypeId;
export const CustomTopicsProvider = () => Provider.succeed(CustomTopics, {
    stables: ["zoneId", "initialTopics"],
    list: Effect.fn(function* () {
        const { accountId } = yield* yield* CloudflareEnvironment;
        // No account-wide API for this zone singleton — enumerate every
        // zone in the account and read its custom-topics list (the list
        // always exists, defaulting to empty, on every entitled zone).
        const allZones = yield* listAllZones(accountId);
        const rows = yield* Effect.forEach(allZones.map((zone) => zone.id), (zoneId) => aiSecurity.getCustomTopic({ zoneId }).pipe(Effect.map((observed) => {
            const topics = normalizeTopics(observed.topics);
            return {
                zoneId,
                topics,
                // A freshly listed item adopts its observed list as the
                // pre-management baseline, mirroring a cold `read`.
                initialTopics: topics,
            };
        }), 
        // AI Security is entitlement-gated and zones may be partial
        // or deleted out-of-band — skip any zone we can't read.
        Effect.catchTag(["AiSecurityNotEntitled", "ZoneNotAuthorized", "Forbidden"], () => Effect.succeed(undefined))), { concurrency: 10 });
        return rows.filter((row) => row !== undefined);
    }),
    diff: Effect.fn(function* ({ olds = {}, news, output }) {
        const o = olds;
        const n = news;
        // zoneId is Input<string>; compare only once both sides are concrete.
        const oldZoneId = output?.zoneId ?? (typeof o.zoneId === "string" ? o.zoneId : undefined);
        if (oldZoneId !== undefined &&
            typeof n.zoneId === "string" &&
            oldZoneId !== n.zoneId) {
            return { action: "replace" };
        }
        return undefined;
    }),
    read: Effect.fn(function* ({ output, olds }) {
        const zoneId = output?.zoneId ?? olds?.zoneId;
        if (!zoneId)
            return undefined;
        const observed = yield* aiSecurity.getCustomTopic({ zoneId }).pipe(
        // Zone deleted out-of-band — the singleton is gone with it.
        Effect.catchTag("ZoneNotAuthorized", () => Effect.succeed(undefined)));
        if (observed === undefined)
            return undefined;
        // The list is a singleton that always exists (default empty) —
        // there is nothing to "own", so a cold read adopts freely (never
        // `Unowned`). The observed list at adoption time becomes the
        // `initialTopics` restored on destroy.
        const topics = normalizeTopics(observed.topics);
        const initialTopics = output !== undefined ? output.initialTopics : topics;
        return { zoneId, topics, initialTopics };
    }),
    reconcile: Effect.fn(function* ({ news, output }) {
        // Inputs have been resolved to concrete strings by Plan.
        const zoneId = news.zoneId;
        const desired = news.topics;
        // 1. Observe — the singleton always exists; read the live list.
        const observed = yield* aiSecurity.getCustomTopic({ zoneId });
        const observedTopics = normalizeTopics(observed.topics);
        // 2. Capture — the pre-management list, restored on destroy.
        //    `output` (including an adoption read) already carries it;
        //    otherwise this is our first touch and the observed list is
        //    the zone's original.
        const initialTopics = output !== undefined ? output.initialTopics : observedTopics;
        // 3. Sync — PUT the full desired list only when it differs.
        if (topicsEqual(observedTopics, desired)) {
            return { zoneId, topics: observedTopics, initialTopics };
        }
        const updated = yield* aiSecurity.putCustomTopic({
            zoneId,
            topics: desired,
        });
        return {
            zoneId,
            topics: normalizeTopics(updated.topics ?? desired),
            initialTopics,
        };
    }),
    delete: Effect.fn(function* ({ output }) {
        const { zoneId, initialTopics } = output;
        // Observe — if the zone itself is gone, so is the list; if the
        // entitlement was revoked, the list is unreachable and there is
        // nothing we can restore.
        const observed = yield* aiSecurity.getCustomTopic({ zoneId }).pipe(Effect.catchTag("ZoneNotAuthorized", () => Effect.succeed(undefined)), Effect.catchTag("AiSecurityNotEntitled", () => Effect.succeed(undefined)));
        if (observed === undefined)
            return;
        // Restore the pre-management list; skip the call when it already
        // matches (idempotent re-delete after a crashed run).
        if (topicsEqual(normalizeTopics(observed.topics), initialTopics))
            return;
        yield* aiSecurity
            .putCustomTopic({ zoneId, topics: initialTopics })
            .pipe(Effect.catchTag("ZoneNotAuthorized", () => Effect.void));
    }),
});
/**
 * Normalize the API's `topics ?? null` into a concrete (mutable) array.
 */
const normalizeTopics = (topics) => (topics ?? []).map((t) => ({ ...t }));
/**
 * Order-insensitive structural equality on the `topic` key — the PUT
 * replaces the whole list, so two lists are equal when they contain the
 * same `{ label, topic }` pairs regardless of order.
 */
const topicsEqual = (a, b) => {
    if (a.length !== b.length)
        return false;
    const key = (t) => `${t.topic}${t.label}`;
    const as = a.map(key).sort();
    const bs = b.map(key).sort();
    return as.every((k, i) => k === bs[i]);
};
//# sourceMappingURL=CustomTopics.js.map