import * as magicTransit from "@distilled.cloud/cloudflare/magic-transit";
import * as Effect from "effect/Effect";
import * as Predicate from "effect/Predicate";
import * as Stream from "effect/Stream";
import { Unowned } from "../../AdoptPolicy.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
import { CloudflareEnvironment } from "../CloudflareEnvironment.js";
const TypeId = "Cloudflare.MagicTransit.App";
/**
 * A custom Magic WAN app — a named set of hostnames and/or IP subnets used
 * for traffic steering and policy decisions, complementing Cloudflare's
 * managed app definitions.
 *
 * Requires a Magic WAN subscription — accounts without it receive a typed
 * `MagicWanUnauthorized` error (Cloudflare code 1025).
 *
 * All properties are mutable in place via PATCH.
 * ### Creating an app
 * **Example:** App matching hostnames
 * ```typescript
 * const app = yield* Cloudflare.MagicTransit.MagicApp("crm", {
 *   name: "Internal CRM",
 *   type: "Business",
 *   hostnames: ["crm.example.com"],
 * });
 * ```
 *
 * **Example:** App matching IP subnets
 * ```typescript
 * const app = yield* Cloudflare.MagicTransit.MagicApp("voip", {
 *   name: "VoIP",
 *   type: "Communication",
 *   ipSubnets: ["192.0.2.0/24", "198.51.100.0/24"],
 * });
 * ```
 *
 * @see https://developers.cloudflare.com/magic-wan/configuration/apps/
 *
 * @resource
 * @product Magic Transit
 * @category Network
 */
export const MagicApp = Resource(TypeId);
/**
 * Returns true if the given value is a MagicApp resource.
 */
export const isMagicApp = (value) => Predicate.hasProperty(value, "Type") && value.Type === TypeId;
export const MagicAppProvider = () => Provider.succeed(MagicApp, {
    stables: ["appId", "accountId"],
    read: Effect.fn(function* ({ output, olds }) {
        const { accountId } = yield* yield* CloudflareEnvironment;
        const acct = output?.accountId ?? accountId;
        if (output?.appId) {
            const observed = yield* getApp(acct, output.appId);
            if (observed)
                return toAttributes(observed, acct);
        }
        // Cold read — match by name. Apps carry no ownership markers;
        // report as Unowned so takeover is gated behind the adopt policy.
        const name = output?.name ?? olds?.name;
        if (name) {
            const observed = yield* findByName(acct, name);
            if (observed)
                return Unowned(toAttributes(observed, acct));
        }
        return undefined;
    }),
    reconcile: Effect.fn(function* ({ news, output }) {
        const { accountId } = yield* yield* CloudflareEnvironment;
        // Observe — there is no getApp endpoint; scan the list by cached id
        // first, then by name.
        let observed = output?.appId
            ? yield* getApp(accountId, output.appId)
            : undefined;
        if (!observed) {
            observed = yield* findByName(accountId, news.name);
        }
        // Ensure — create when missing.
        if (!observed) {
            const created = yield* magicTransit.createApp({
                accountId,
                name: news.name,
                type: news.type,
                hostnames: news.hostnames,
                ipSubnets: news.ipSubnets,
            });
            return toAttributes(created, accountId);
        }
        // Sync — diff observed cloud state against desired; PATCH only on a
        // real delta.
        const dirty = (observed.name ?? undefined) !== news.name ||
            (observed.type ?? undefined) !== news.type ||
            (news.hostnames !== undefined &&
                !sameList(observed.hostnames, news.hostnames)) ||
            (news.ipSubnets !== undefined &&
                !sameList(observed.ipSubnets, news.ipSubnets));
        if (dirty) {
            const updated = yield* magicTransit.patchApp({
                accountId,
                accountAppId: observed.accountAppId,
                name: news.name,
                type: news.type,
                hostnames: news.hostnames,
                ipSubnets: news.ipSubnets,
            });
            observed = updated;
        }
        return toAttributes(observed, accountId);
    }),
    delete: Effect.fn(function* ({ output }) {
        yield* magicTransit
            .deleteApp({
            accountId: output.accountId,
            accountAppId: output.appId,
        })
            .pipe(Effect.catchTag("AppNotFound", () => Effect.void));
    }),
    // Account collection — exhaustively paginate the account-scoped apps list
    // and hydrate each account app into the `read` Attributes shape. Magic WAN
    // is entitlement-gated; unentitled accounts reject with a typed error, in
    // which case there are no apps to enumerate → [].
    list: Effect.fn(function* () {
        const { accountId } = yield* yield* CloudflareEnvironment;
        return yield* magicTransit.listApps.pages({ accountId }).pipe(Stream.runCollect, Effect.map((chunk) => Array.from(chunk).flatMap((page) => (page.result ?? [])
            .filter(isAccountApp)
            .map((app) => toAttributes(app, accountId)))), Effect.catchTag(["MagicWanUnauthorized", "Forbidden"], () => Effect.succeed([])));
    }),
});
const isAccountApp = (app) => "accountAppId" in app;
/**
 * Read an account app by id via the list endpoint (there is no getApp).
 */
const getApp = (accountId, appId) => magicTransit
    .listApps({ accountId })
    .pipe(Effect.map((r) => r.result.filter(isAccountApp).find((app) => app.accountAppId === appId)));
/**
 * Find an account app by exact name. Names are not enforced unique; pick
 * the first match deterministically by id.
 */
const findByName = (accountId, name) => magicTransit.listApps({ accountId }).pipe(Effect.map((r) => r.result
    .filter(isAccountApp)
    .filter((app) => app.name === name)
    .sort((a, b) => a.accountAppId.localeCompare(b.accountAppId))
    .at(0)));
const sameList = (a, b) => [...(a ?? [])].sort().join(",") === [...(b ?? [])].sort().join(",");
const toAttributes = (app, accountId) => ({
    appId: app.accountAppId,
    accountId,
    name: app.name ?? "",
    type: app.type ?? "",
    hostnames: app.hostnames ?? undefined,
    ipSubnets: app.ipSubnets ?? undefined,
});
//# sourceMappingURL=App.js.map