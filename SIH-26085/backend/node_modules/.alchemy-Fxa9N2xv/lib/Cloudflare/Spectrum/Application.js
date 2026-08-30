import * as spectrum from "@distilled.cloud/cloudflare/spectrum";
import * as Effect from "effect/Effect";
import * as Predicate from "effect/Predicate";
import * as Stream from "effect/Stream";
import { Unowned } from "../../AdoptPolicy.js";
import { isResolved } from "../../Diff.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
import { CloudflareEnvironment } from "../CloudflareEnvironment.js";
import { listAllZones } from "../Zone/lookup.js";
const TypeId = "Cloudflare.Spectrum.Application";
/**
 * A Cloudflare Spectrum application — DDoS protection and proxying for
 * arbitrary TCP/UDP services (SSH, Minecraft, RDP, custom protocols), not
 * just HTTP.
 *
 * An application is identified by its auto-assigned `appId`; its
 * user-visible identity within a zone is the edge hostname (`dns.name`) +
 * `protocol` pair. All configuration is mutable in place via PUT — only
 * `zoneId` forces a replacement.
 *
 * Spectrum is plan-gated: Pro zones get SSH (`tcp/22`) and Minecraft
 * (`tcp/25565`), Business adds RDP, and Enterprise unlocks arbitrary
 * ports/ranges, UDP, static edge IPs, and PROXY Protocol. On unentitled
 * zones every create fails with the typed `SpectrumProtocolNotAvailable`
 * error.
 *
 * Safety: Spectrum applications carry no ownership markers. When there is
 * no prior state, `read` scans the zone for an application with the same
 * `dns.name` + `protocol` and reports it as `Unowned`, so the engine
 * refuses to take it over unless `--adopt` (or `adopt(true)`) is set.
 * ### Proxying SSH
 * **Example:** SSH on a fixed origin address
 * ```typescript
 * const ssh = yield* Cloudflare.Spectrum.Application("Ssh", {
 *   zoneId: zone.zoneId,
 *   dns: { type: "CNAME", name: "ssh.example.com" },
 *   protocol: "tcp/22",
 *   originDirect: ["tcp://203.0.113.1:22"],
 * });
 * ```
 *
 * ### Origin via DNS
 * **Example:** Resolve the origin by hostname
 * ```typescript
 * yield* Cloudflare.Spectrum.Application("Minecraft", {
 *   zoneId: zone.zoneId,
 *   dns: { type: "CNAME", name: "mc.example.com" },
 *   protocol: "tcp/25565",
 *   originDns: { name: "origin.example.com" },
 *   originPort: 25565,
 * });
 * ```
 *
 * ### Enterprise features
 * **Example:** UDP with IP firewall and PROXY protocol
 * ```typescript
 * // Arbitrary ports/protocols, UDP, and proxyProtocol require an
 * // Enterprise plan with Spectrum.
 * yield* Cloudflare.Spectrum.Application("Dns", {
 *   zoneId: zone.zoneId,
 *   dns: { type: "CNAME", name: "dns.example.com" },
 *   protocol: "udp/53",
 *   originDirect: ["udp://203.0.113.1:53"],
 *   ipFirewall: true,
 *   proxyProtocol: "simple",
 * });
 * ```
 *
 * @see https://developers.cloudflare.com/spectrum/
 *
 * @resource
 * @product Spectrum
 * @category Network
 */
export const Application = Resource(TypeId);
/**
 * Returns true if the given value is a Application resource.
 */
export const isApplication = (value) => Predicate.hasProperty(value, "Type") && value.Type === TypeId;
export const ApplicationProvider = () => Provider.succeed(Application, {
    stables: ["appId", "zoneId", "createdOn"],
    diff: Effect.fn(function* ({ olds, news }) {
        // `news` may still contain unresolved plan-time expressions — defer
        // to the engine's default update logic until everything is concrete.
        if (!isResolved(news))
            return undefined;
        // Everything is mutable through the PUT update except the zone the
        // application lives in (a path parameter).
        if (typeof olds?.zoneId === "string" &&
            typeof news.zoneId === "string" &&
            olds.zoneId !== news.zoneId) {
            return { action: "replace" };
        }
        return undefined;
    }),
    read: Effect.fn(function* ({ output, olds }) {
        const zoneId = output?.zoneId ??
            (typeof olds?.zoneId === "string" ? olds.zoneId : undefined);
        if (zoneId === undefined)
            return undefined;
        // Owned path: refresh by our persisted application id.
        if (output?.appId) {
            const observed = yield* getApp(zoneId, output.appId);
            return observed ? toAttributes(observed, zoneId) : undefined;
        }
        // Adoption path: an application with this hostname + protocol may
        // already exist in the zone. Spectrum apps carry no ownership
        // markers, so we cannot prove we created it — brand it `Unowned` so
        // the engine refuses to take over unless `adopt` is set.
        const dnsName = output?.dnsName ?? olds?.dns.name;
        const protocol = output?.protocol ?? olds?.protocol;
        if (dnsName !== undefined && protocol !== undefined) {
            const observed = yield* findByIdentity(zoneId, dnsName, protocol);
            if (observed)
                return Unowned(toAttributes(observed, zoneId));
        }
        return undefined;
    }),
    reconcile: Effect.fn(function* ({ news, output }) {
        // Inputs have been resolved to concrete strings by Plan.
        const zoneId = news.zoneId;
        // 1. Observe — the app id cached on `output` is a hint, not a
        //    guarantee: a missing application falls through to the identity
        //    scan and then to create.
        let observed = output?.appId
            ? yield* getApp(zoneId, output.appId)
            : undefined;
        // 2. Fall back to scanning the zone for a hostname + protocol match.
        //    Ownership has already been verified upstream — `read` reports
        //    existing applications as `Unowned` and the engine gates
        //    takeover behind the adopt policy before reconcile ever runs.
        if (!observed) {
            observed = yield* findByIdentity(zoneId, news.dns.name, news.protocol);
        }
        // 3. Ensure — create when missing.
        if (!observed) {
            const created = yield* spectrum.createApp({
                zoneId,
                ...toRequestBody(news),
            });
            return toAttributes(created, zoneId);
        }
        // 4. Sync — diff observed cloud state against desired; the update
        //    API is a PUT that requires the full body, so send everything,
        //    but skip the call entirely on a no-op.
        if (!isDirty(observed, news)) {
            return toAttributes(observed, zoneId);
        }
        const updated = yield* spectrum.updateApp({
            zoneId,
            appId: observed.id,
            ...toRequestBody(news),
        });
        return toAttributes(updated, zoneId);
    }),
    delete: Effect.fn(function* ({ output }) {
        // Deleting the app also removes the Spectrum-managed edge DNS
        // record. An already-gone app answers with the typed
        // `SpectrumAppNotFound` (Cloudflare code 10006) — idempotent.
        yield* spectrum
            .deleteApp({ zoneId: output.zoneId, appId: output.appId })
            .pipe(Effect.catchTag("SpectrumAppNotFound", () => Effect.void));
    }),
    // Zone-scoped collection: Spectrum applications live inside a zone and
    // are listed per-zone (`/zones/{zone_id}/spectrum/apps`). Enumerate every
    // zone, exhaustively paginate each zone's apps, and hydrate into the same
    // `Attributes` shape `read` returns. Zones without Spectrum entitlement
    // reject the route with the typed `Forbidden` tag — skip them.
    list: Effect.fn(function* () {
        const { accountId } = yield* yield* CloudflareEnvironment;
        const zones = yield* listAllZones(accountId);
        const rows = yield* Effect.forEach(zones, (zone) => spectrum.listApps.pages({ zoneId: zone.id }).pipe(Stream.runCollect, Effect.map((chunk) => Array.from(chunk).flatMap((page) => (page.result ?? []).map((app) => toAttributes(app, zone.id)))), Effect.catchTag("Forbidden", () => Effect.succeed([]))), { concurrency: 10 });
        return rows.flat();
    }),
});
const asFull = (app) => app;
/**
 * Read an application by id, mapping "gone" (`SpectrumAppNotFound`,
 * Cloudflare error code 10006) to `undefined`.
 */
const getApp = (zoneId, appId) => spectrum.getApp({ zoneId, appId }).pipe(Effect.map((app) => app), Effect.catchTag("SpectrumAppNotFound", () => Effect.succeed(undefined)));
/**
 * Find an application by exact `dns.name` + `protocol` within the zone —
 * the pair is the application's user-visible identity.
 */
const findByIdentity = (zoneId, dnsName, protocol) => spectrum.listApps.items({ zoneId }).pipe(Stream.filter((app) => app.dns.name === dnsName && app.protocol === protocol), Stream.take(1), Stream.runCollect, Effect.map((chunk) => Array.from(chunk)[0]));
/**
 * The full PUT/POST body derived from the desired props. Optional fields
 * the user did not set are omitted so the API applies its defaults — in
 * particular `tls`, which Cloudflare rejects on `direct` TCP apps.
 */
const toRequestBody = (news) => ({
    dns: { name: news.dns.name, type: news.dns.type },
    protocol: news.protocol,
    trafficType: news.trafficType,
    originDirect: news.originDirect,
    originDns: news.originDns,
    originPort: news.originPort,
    tls: news.tls,
    argoSmartRouting: news.argoSmartRouting,
    ipFirewall: news.ipFirewall,
    proxyProtocol: news.proxyProtocol,
    edgeIps: news.edgeIps,
    virtualNetworkId: news.virtualNetworkId,
});
/**
 * Compare observed cloud state against the desired props. Fields the user
 * left unset are only considered dirty when the observed value differs
 * from the API default, so a no-op deploy skips the PUT entirely.
 */
const isDirty = (observed, news) => {
    const o = asFull(observed);
    return (o.dns.name !== news.dns.name ||
        o.dns.type !== news.dns.type ||
        o.protocol !== news.protocol ||
        (o.trafficType ?? "direct") !== (news.trafficType ?? "direct") ||
        !sameList(o.originDirect ?? [], news.originDirect ?? []) ||
        (o.originDns?.name ?? undefined) !== news.originDns?.name ||
        (o.originPort ?? undefined) !== news.originPort ||
        (news.tls !== undefined && o.tls !== news.tls) ||
        (o.argoSmartRouting ?? false) !== (news.argoSmartRouting ?? false) ||
        (o.ipFirewall ?? false) !== (news.ipFirewall ?? false) ||
        (o.proxyProtocol ?? "off") !== (news.proxyProtocol ?? "off") ||
        (news.edgeIps !== undefined && edgeIpsDirty(o, news.edgeIps)) ||
        (news.virtualNetworkId !== undefined &&
            (o.virtualNetworkId ?? undefined) !== news.virtualNetworkId));
};
const edgeIpsDirty = (o, desired) => {
    const observed = o.edgeIps ?? {};
    const observedIps = "ips" in observed ? (observed.ips ?? []) : [];
    const observedConnectivity = "connectivity" in observed
        ? (observed.connectivity ?? "all")
        : "all";
    return ((observed.type ?? "dynamic") !== (desired.type ?? "dynamic") ||
        (desired.connectivity !== undefined &&
            observedConnectivity !== desired.connectivity) ||
        (desired.ips !== undefined && !sameList(observedIps, desired.ips)));
};
const sameList = (observed, desired) => observed.length === desired.length &&
    [...observed].sort().join(",") === [...desired].sort().join(",");
const toAttributes = (app, zoneId) => {
    const a = asFull(app);
    return {
        appId: a.id,
        zoneId,
        // Cloudflare always echoes both dns fields for a persisted app —
        // distilled just types them as optional/nullable.
        dnsName: a.dns.name ?? "",
        dnsType: (a.dns.type ?? "CNAME"),
        protocol: a.protocol,
        trafficType: (a.trafficType ?? "direct"),
        originDirect: a.originDirect ? [...a.originDirect] : undefined,
        originDns: a.originDns
            ? {
                name: a.originDns.name ?? undefined,
                ttl: a.originDns.ttl ?? undefined,
                type: (a.originDns.type ?? undefined),
            }
            : undefined,
        originPort: a.originPort ?? undefined,
        tls: (a.tls ?? undefined),
        argoSmartRouting: a.argoSmartRouting ?? false,
        ipFirewall: a.ipFirewall ?? false,
        proxyProtocol: (a.proxyProtocol ?? "off"),
        createdOn: a.createdOn,
        modifiedOn: a.modifiedOn,
    };
};
//# sourceMappingURL=Application.js.map