import * as web3 from "@distilled.cloud/cloudflare/web3";
import * as Effect from "effect/Effect";
import * as Predicate from "effect/Predicate";
import * as Stream from "effect/Stream";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
import { CloudflareEnvironment } from "../CloudflareEnvironment.js";
import { listAllZones } from "../Zone/lookup.js";
const TypeId = "Cloudflare.Web3.HostnameContentList";
/**
 * The IPFS content-blocking list of a Web3 universal-path gateway hostname —
 * blocks specific CIDs or content paths from being served.
 *
 * The content list is a per-hostname singleton: it always exists for an
 * `ipfs_universal_path` hostname (empty by default), so this resource never
 * creates or deletes a physical object. Reconciliation replaces the whole
 * list declaratively via the bulk PUT, and destroy resets the list to empty.
 * ### Blocking content
 * **Example:** Block a CID and a content path
 * ```typescript
 * const gateway = yield* Cloudflare.Web3.Hostname("UniversalGateway", {
 *   zoneId: zone.zoneId,
 *   name: "gateway.example.com",
 *   target: "ipfs_universal_path",
 * });
 *
 * yield* Cloudflare.Web3.HostnameContentList("Blocklist", {
 *   zoneId: zone.zoneId,
 *   hostnameId: gateway.hostnameId,
 *   entries: [
 *     {
 *       type: "cid",
 *       content: "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco",
 *       description: "blocked CID",
 *     },
 *     {
 *       type: "content_path",
 *       content: "/ipfs/QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco/wiki",
 *     },
 *   ],
 * });
 * ```
 *
 * **Example:** Clear the blocklist
 * ```typescript
 * // An empty entries array removes every block (also what destroy does).
 * yield* Cloudflare.Web3.HostnameContentList("Blocklist", {
 *   zoneId: zone.zoneId,
 *   hostnameId: gateway.hostnameId,
 *   entries: [],
 * });
 * ```
 *
 * @see https://developers.cloudflare.com/web3/
 *
 * @resource
 * @product Web3
 * @category Domains & DNS
 */
export const HostnameContentList = Resource(TypeId, {
    aliases: ["Cloudflare.Web3HostnameContentList"],
});
/**
 * Returns true if the given value is a HostnameContentList resource.
 */
export const isHostnameContentList = (value) => Predicate.hasProperty(value, "Type") && value.Type === TypeId;
export const HostnameContentListProvider = () => Provider.succeed(HostnameContentList, {
    stables: ["zoneId", "hostnameId"],
    list: Effect.fn(function* () {
        const { accountId } = yield* yield* CloudflareEnvironment;
        // The content list is a per-hostname singleton keyed by
        // {zoneId, hostnameId}. Enumerate every zone, list its Web3
        // hostnames, keep only universal-path gateways (other targets
        // reject content-list ops), and read each one's list.
        const zones = yield* listAllZones(accountId);
        const rows = yield* Effect.forEach(zones, (zone) => web3.listHostnames.items({ zoneId: zone.id }).pipe(Stream.runCollect, Effect.map((chunk) => Array.from(chunk).filter((h) => h.id != null && h.target === "ipfs_universal_path")), Effect.flatMap((hostnames) => Effect.forEach(hostnames, (h) => observeContentList(zone.id, h.id).pipe(Effect.catchTag("Forbidden", () => Effect.succeed(undefined))), { concurrency: 10 })), 
        // Web3 is entitlement-gated and freshly minted tokens can
        // briefly 403 — skip zones we can't enumerate.
        Effect.catchTag("Forbidden", () => Effect.succeed([]))), { concurrency: 10 });
        return rows
            .flat()
            .filter((row) => row !== undefined);
    }),
    diff: Effect.fn(function* ({ olds = {}, news, output }) {
        const o = olds;
        const n = news;
        // zoneId/hostnameId are Input<string>; compare only once both
        // sides are concrete. The content list is a sub-singleton of the
        // hostname — pointing elsewhere replaces it.
        const oldZone = output?.zoneId ?? o.zoneId;
        if (typeof oldZone === "string" &&
            typeof n.zoneId === "string" &&
            oldZone !== n.zoneId) {
            return { action: "replace" };
        }
        const oldHostname = output?.hostnameId ?? o.hostnameId;
        if (typeof oldHostname === "string" &&
            typeof n.hostnameId === "string" &&
            oldHostname !== n.hostnameId) {
            return { action: "replace" };
        }
        return undefined;
    }),
    read: Effect.fn(function* ({ output, olds }) {
        const zoneId = output?.zoneId ??
            (typeof olds?.zoneId === "string" ? olds.zoneId : undefined);
        const hostnameId = output?.hostnameId ??
            (typeof olds?.hostnameId === "string" ? olds.hostnameId : undefined);
        if (zoneId === undefined || hostnameId === undefined)
            return undefined;
        // Settings-singleton semantics: the list always exists for a
        // universal-path hostname (empty by default), so it is never
        // `Unowned`. A deleted hostname reads as gone.
        return yield* observeContentList(zoneId, hostnameId);
    }),
    reconcile: Effect.fn(function* ({ news }) {
        // Inputs have been resolved to concrete strings by Plan.
        const zoneId = news.zoneId;
        const hostnameId = news.hostnameId;
        const desired = {
            zoneId,
            hostnameId,
            action: news.action ?? "block",
            entries: news.entries ?? [],
        };
        // Observe — read the live list; the singleton always exists for a
        // universal-path hostname, so "missing" only means the hostname
        // itself is gone (which is a real failure for reconcile).
        const observed = yield* observeContentList(zoneId, hostnameId);
        // Sync — the bulk PUT replaces action + entries declaratively;
        // skip the API call entirely on a no-op.
        if (observed && sameContentList(observed, desired)) {
            return observed;
        }
        yield* web3.putHostnameIpfsUniversalPathContentList({
            zoneId,
            identifier: hostnameId,
            action: desired.action,
            entries: desired.entries,
        });
        return desired;
    }),
    delete: Effect.fn(function* ({ output }) {
        // There is no DELETE endpoint — destroying the resource resets the
        // singleton to its empty default. If the hostname itself is already
        // gone (or no longer a universal-path gateway), there is nothing
        // left to reset.
        yield* web3
            .putHostnameIpfsUniversalPathContentList({
            zoneId: output.zoneId,
            identifier: output.hostnameId,
            action: "block",
            entries: [],
        })
            .pipe(Effect.catchTag(["Web3HostnameNotFound", "InvalidWeb3HostnameTarget"], () => Effect.void));
    }),
});
/**
 * Read the content list (action) plus its entries, mapping a gone hostname
 * (`Web3HostnameNotFound`, code 1002) or a hostname that is not a
 * universal-path gateway (`InvalidWeb3HostnameTarget`, code 1006) to
 * `undefined`.
 */
const observeContentList = (zoneId, hostnameId) => Effect.gen(function* () {
    const list = yield* web3.getHostnameIpfsUniversalPathContentList({
        zoneId,
        identifier: hostnameId,
    });
    const entries = yield* web3.listHostnameIpfsUniversalPathContentListEntries({ zoneId, identifier: hostnameId });
    return {
        zoneId,
        hostnameId,
        action: (list.action ?? "block"),
        entries: (entries.entries ?? []).map((entry) => ({
            content: entry.content ?? "",
            type: (entry.type ?? "cid"),
            ...(entry.description != null
                ? { description: entry.description }
                : {}),
        })),
    };
}).pipe(Effect.catchTag(["Web3HostnameNotFound", "InvalidWeb3HostnameTarget"], () => Effect.succeed(undefined)));
/**
 * Order-insensitive comparison of two content lists by (content, type,
 * description).
 */
const sameContentList = (observed, desired) => observed.action === desired.action &&
    observed.entries.length === desired.entries.length &&
    serializeEntries(observed.entries) === serializeEntries(desired.entries);
const serializeEntries = (entries) => entries
    .map((entry) => `${entry.type} ${entry.content} ${entry.description ?? ""}`)
    .sort()
    .join("");
//# sourceMappingURL=ContentList.js.map