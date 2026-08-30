import * as botManagement from "@distilled.cloud/cloudflare/bot-management";
import * as Effect from "effect/Effect";
import * as Predicate from "effect/Predicate";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
import { CloudflareEnvironment } from "../CloudflareEnvironment.js";
import { listAllZones } from "../Zone/lookup.js";
const TypeId = "Cloudflare.BotManagement.BotManagement";
/**
 * The bot-management configuration of a Cloudflare zone — a zone-scoped
 * **singleton**: every zone always has exactly one bot-management config,
 * so there is no create or delete on the Cloudflare side. Reconciling this
 * resource adopts the singleton and PUTs only the fields you explicitly
 * set, leaving every other field untouched.
 *
 * Which fields are writable depends on the zone's plan (see
 * {@link Settings}). Setting a field outside the zone's plan
 * shape fails validation on Cloudflare's side.
 *
 * On destroy, the resource restores the fields it managed to the values
 * observed before its first write (the `initialSettings` snapshot).
 * Fields that were never set by this resource are not touched. Settings
 * changed out-of-band after the snapshot was taken, or fields the zone's
 * plan no longer accepts, cannot be restored.
 * ### Super Bot Fight Mode
 * **Example:** Challenge definitely automated traffic (Pro and above)
 * ```typescript
 * yield* Cloudflare.BotManagement.BotManagement("Bots", {
 *   zoneId: zone.zoneId,
 *   sbfmDefinitelyAutomated: "managed_challenge",
 *   sbfmVerifiedBots: "allow",
 * });
 * ```
 *
 * **Example:** Static resource protection and WordPress optimization
 * ```typescript
 * yield* Cloudflare.BotManagement.BotManagement("Bots", {
 *   zoneId: zone.zoneId,
 *   sbfmDefinitelyAutomated: "block",
 *   sbfmStaticResourceProtection: true,
 *   optimizeWordpress: true,
 * });
 * ```
 *
 * ### AI bot protection
 * **Example:** Block AI scrapers and crawlers
 * ```typescript
 * yield* Cloudflare.BotManagement.BotManagement("Bots", {
 *   zoneId: zone.zoneId,
 *   aiBotsProtection: "block",
 *   crawlerProtection: "enabled",
 * });
 * ```
 *
 * ### Bot Fight Mode (Free plans)
 * **Example:** Enable Bot Fight Mode
 * ```typescript
 * yield* Cloudflare.BotManagement.BotManagement("Bots", {
 *   zoneId: zone.zoneId,
 *   fightMode: true,
 * });
 * ```
 *
 * @see https://developers.cloudflare.com/bots/
 *
 * @resource
 * @product Bot Management
 * @category Application Security
 */
export const BotManagement = Resource(TypeId, {
    aliases: ["Cloudflare.BotManagement"],
});
/**
 * Returns true if the given value is a BotManagement resource.
 */
export const isBotManagement = (value) => Predicate.hasProperty(value, "Type") && value.Type === TypeId;
/**
 * Every writable settings key, used to project observed cloud state and
 * user props into the only-send-what-is-set PUT body.
 */
const SETTINGS_KEYS = [
    "aiBotsProtection",
    "crawlerProtection",
    "contentBotsProtection",
    "cfRobotsVariant",
    "enableJs",
    "isRobotsTxtManaged",
    "fightMode",
    "sbfmDefinitelyAutomated",
    "sbfmLikelyAutomated",
    "sbfmVerifiedBots",
    "sbfmStaticResourceProtection",
    "optimizeWordpress",
    "autoUpdateModel",
    "bmCookieEnabled",
    "suppressSessionScore",
];
export const BotManagementProvider = () => Provider.succeed(BotManagement, {
    nuke: { singleton: true },
    stables: ["zoneId", "initialSettings"],
    list: Effect.fn(function* () {
        const { accountId } = yield* yield* CloudflareEnvironment;
        // No account-wide API for this zone singleton — enumerate every
        // zone in the account and read its bot-management config (every
        // live zone always has exactly one).
        const allZones = yield* listAllZones(accountId);
        const rows = yield* Effect.forEach(allZones.map((zone) => zone.id), (zoneId) => 
        // `observe` maps a dead zone (`InvalidRoute`) to undefined; a
        // plan-gated zone forbids the read — skip both.
        observe(zoneId).pipe(Effect.map((observed) => observed === undefined
            ? undefined
            : toAttributes(zoneId, observed, pickSettings(observed))), Effect.catchTag("Forbidden", () => Effect.succeed(undefined))), { concurrency: 10 });
        return rows.filter((row) => row !== undefined);
    }),
    diff: Effect.fn(function* ({ olds = {}, news, output }) {
        const o = olds;
        const n = news;
        // zoneId is Input<string>; compare only when both sides are concrete.
        const oldZone = output?.zoneId ?? o.zoneId;
        if (typeof oldZone === "string" &&
            typeof n.zoneId === "string" &&
            oldZone !== n.zoneId) {
            return { action: "replace" };
        }
    }),
    read: Effect.fn(function* ({ output, olds }) {
        // The config is a singleton — it exists iff the zone exists.
        const zoneId = output?.zoneId ?? olds?.zoneId;
        if (!zoneId)
            return undefined;
        const observed = yield* observe(zoneId);
        if (!observed)
            return undefined;
        return toAttributes(zoneId, observed, output?.initialSettings ?? pickSettings(observed));
    }),
    reconcile: Effect.fn(function* ({ news, output }) {
        // Inputs are resolved to concrete strings by Plan.
        const zoneId = (output?.zoneId ?? news.zoneId);
        // 1. Observe — the singleton always exists for a live zone.
        let observed = yield* botManagement.getBotManagement({ zoneId });
        // 2. Snapshot — capture pre-management values once; `output` acts
        //    as the cache that keeps the very first observation sticky.
        const initialSettings = output?.initialSettings ?? pickSettings(observed);
        // 3. Sync — diff observed against the fields the user set and PUT
        //    only when something actually differs. Unset fields are never
        //    sent (plan-shape validation + don't clobber dashboard config).
        const desired = pickSettings(news);
        if (!settingsEqual(desired, pickSettings(observed))) {
            observed = yield* botManagement.putBotManagement({
                zoneId,
                ...desired,
            });
        }
        // 4. Return fresh attributes.
        return toAttributes(zoneId, observed, initialSettings);
    }),
    delete: Effect.fn(function* ({ output, olds }) {
        // Singleton — nothing to delete on the Cloudflare side. Restore the
        // fields this resource managed (i.e. the props that were set) to
        // their pre-management snapshot values. Fields whose snapshot value
        // is absent (the plan never exposed them, or Cloudflare returned
        // null) cannot be restored and are left as-is.
        const observed = yield* observe(output.zoneId);
        if (!observed)
            return; // zone is gone — nothing to restore
        const managed = pickSettings(olds ?? {});
        const current = pickSettings(observed);
        const restore = {};
        for (const key of SETTINGS_KEYS) {
            const snapshot = output.initialSettings?.[key];
            if (managed[key] !== undefined &&
                snapshot !== undefined &&
                current[key] !== snapshot) {
                restore[key] = snapshot;
            }
        }
        if (Object.keys(restore).length > 0) {
            yield* botManagement.putBotManagement({
                zoneId: output.zoneId,
                ...restore,
            });
        }
    }),
});
/**
 * Read the zone's bot-management config, mapping a dead zone
 * (`InvalidRoute`, Cloudflare code 7003) to `undefined`.
 */
const observe = (zoneId) => botManagement
    .getBotManagement({ zoneId })
    .pipe(Effect.catchTag("InvalidRoute", () => Effect.succeed(undefined)));
const undef = (v) => v == null ? undefined : v;
/**
 * Project any source (observed union member, props, attrs) onto the
 * writable settings keys, dropping `null`/`undefined` values.
 */
const pickSettings = (source) => {
    const bag = source;
    const out = {};
    for (const key of SETTINGS_KEYS) {
        const value = undef(bag[key]);
        if (value !== undefined)
            out[key] = value;
    }
    return out;
};
/**
 * True when every field set in `desired` matches `observed`. Unset
 * desired fields are ignored — they are dashboard/plan-managed.
 */
const settingsEqual = (desired, observed) => SETTINGS_KEYS.every((key) => desired[key] === undefined || desired[key] === observed[key]);
const toAttributes = (zoneId, observed, initialSettings) => ({
    zoneId,
    ...pickSettings(observed),
    usingLatestModel: undef(observed.usingLatestModel),
    initialSettings,
});
//# sourceMappingURL=BotManagement.js.map