import * as zeroTrust from "@distilled.cloud/cloudflare/zero-trust";
import * as Effect from "effect/Effect";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
import { CloudflareEnvironment } from "../CloudflareEnvironment.js";
/**
 * Manages the **singleton** Cloudflare WARP **default device profile** for
 * an account. The default profile applies to every WARP device not
 * matched by a custom profile.
 * @remarks
 * There is exactly one default profile per account; it cannot be created
 * or deleted. Reconciling this resource patches the existing profile in
 * place and synchronizes the four sibling list endpoints (include,
 * exclude, fallback domains). The `delete` lifecycle is a deliberate
 * no-op — destroying the Alchemy resource only removes our local state,
 * the cloud profile remains intact.
 *
 * Custom (non-default) profiles are a separate resource.
 *
 * ### Configuring split tunneling
 * **Example:** Exclude-mode (default): tunnel everything except listed routes
 * ```typescript
 * yield* Cloudflare.Devices.DeviceDefaultProfile("Default", {
 *   mode: "exclude",
 *   splitTunnelExclude: [
 *     { address: "10.0.0.0/8", description: "RFC1918" },
 *     { address: "192.168.0.0/16", description: "RFC1918" },
 *   ],
 *   excludeOfficeIps: true,
 * });
 * ```
 *
 * **Example:** Include-mode: only listed routes go through WARP
 * ```typescript
 * yield* Cloudflare.Devices.DeviceDefaultProfile("Default", {
 *   mode: "include",
 *   splitTunnelInclude: [
 *     { address: "10.42.0.0/16", description: "Prod VPC" },
 *   ],
 * });
 * ```
 *
 * ### Configuring fallback domains
 * **Example:** Resolve a private suffix via an on-prem DNS server
 * ```typescript
 * yield* Cloudflare.Devices.DeviceDefaultProfile("Default", {
 *   fallbackDomains: [
 *     {
 *       suffix: "corp.example.com",
 *       dnsServer: ["10.0.0.53"],
 *       description: "Corp AD",
 *     },
 *   ],
 *   disableAutoFallback: true,
 * });
 * ```
 *
 * @resource
 * @product Devices
 * @category Cloudflare One (Zero Trust)
 */
export const DeviceDefaultProfile = Resource("Cloudflare.Devices.DefaultProfile");
/**
 * Live `Provider` for {@link DeviceDefaultProfile}. Wire into a Cloudflare
 * provider Layer with `Provider.collection([DeviceDefaultProfile])` plus
 * `DeviceDefaultProfileProvider()`.
 */
export const DeviceDefaultProfileProvider = () => Provider.succeed(DeviceDefaultProfile, {
    nuke: { singleton: true },
    stables: ["accountId"],
    reconcile: Effect.fn(function* ({ news = {} }) {
        const { accountId } = yield* yield* CloudflareEnvironment;
        // 1. Observe — the default profile always exists.
        let obs = yield* observe();
        // 2. Sync — four independent idempotent diffs.
        // (a) General profile patch.
        const desiredMode = news.mode ?? inferMode(obs.profile);
        const observedSm = obs.profile.serviceModeV2;
        const desiredSm = news.serviceModeV2;
        const patchBody = {
            accountId,
        };
        let needsPatch = false;
        const setIf = (key, desired, observed) => {
            if (desired === undefined)
                return;
            if (desired !== observed) {
                patchBody[key] = desired;
                needsPatch = true;
            }
        };
        setIf("captivePortal", news.captivePortal, denull(obs.profile.captivePortal));
        setIf("autoConnect", news.autoConnect, denull(obs.profile.autoConnect));
        setIf("allowedToLeave", news.allowedToLeave, denull(obs.profile.allowedToLeave));
        setIf("allowModeSwitch", news.allowModeSwitch, denull(obs.profile.allowModeSwitch));
        setIf("allowUpdates", news.allowUpdates, denull(obs.profile.allowUpdates));
        setIf("disableAutoFallback", news.disableAutoFallback, denull(obs.profile.disableAutoFallback));
        setIf("excludeOfficeIps", news.excludeOfficeIps, denull(obs.profile.excludeOfficeIps));
        setIf("switchLocked", news.switchLocked, denull(obs.profile.switchLocked));
        // lanAllowMinutes / lanAllowSubnetSize are accepted by PATCH but
        // not surfaced on GET, so we cannot diff them. Push them every
        // time the user sets them — the API is idempotent.
        if (news.lanAllowMinutes !== undefined) {
            patchBody.lanAllowMinutes = news.lanAllowMinutes;
            needsPatch = true;
        }
        if (news.lanAllowSubnetSize !== undefined) {
            patchBody.lanAllowSubnetSize = news.lanAllowSubnetSize;
            needsPatch = true;
        }
        setIf("registerInterfaceIpWithDns", news.registerInterfaceIpWithDns, denull(obs.profile.registerInterfaceIpWithDns));
        setIf("sccmVpnBoundarySupport", news.sccmVpnBoundarySupport, denull(obs.profile.sccmVpnBoundarySupport));
        setIf("supportUrl", news.supportUrl, denull(obs.profile.supportUrl));
        setIf("tunnelProtocol", news.tunnelProtocol, denull(obs.profile.tunnelProtocol));
        if (desiredSm !== undefined &&
            !sameJSON(desiredSm, observedSm
                ? {
                    mode: denull(observedSm.mode),
                    port: denull(observedSm.port),
                }
                : undefined)) {
            patchBody.serviceModeV2 = desiredSm;
            needsPatch = true;
        }
        // `mode` is a derived view of which list is enforced; the CF
        // PATCH endpoint surfaces it as a SIDE-EFFECT of which array
        // (`include`/`exclude`) is non-empty. We let the include/exclude
        // sync blocks below handle persistence.
        void desiredMode;
        if (needsPatch) {
            yield* zeroTrust.patchDevicePolicyDefault(patchBody);
        }
        // (b) Include list.
        if (news.splitTunnelInclude !== undefined) {
            const desired = news.splitTunnelInclude;
            if (!sameJSON(desired, obs.splitTunnelInclude)) {
                yield* zeroTrust.putDevicePolicyDefaultInclude({
                    accountId,
                    body: desired.map(encodeSplit),
                });
            }
        }
        // (c) Exclude list.
        if (news.splitTunnelExclude !== undefined) {
            const desired = news.splitTunnelExclude;
            if (!sameJSON(desired, obs.splitTunnelExclude)) {
                yield* zeroTrust.putDevicePolicyDefaultExclude({
                    accountId,
                    body: desired.map(encodeSplit),
                });
            }
        }
        // (d) Fallback domains.
        if (news.fallbackDomains !== undefined) {
            const desired = news.fallbackDomains;
            if (!sameJSON(desired, obs.fallbackDomains)) {
                yield* zeroTrust.putDevicePolicyDefaultFallbackDomain({
                    accountId,
                    domains: desired.map(encodeFallback),
                });
            }
        }
        // 3. Re-observe so attrs reflect post-sync truth.
        obs = yield* observe();
        return buildAttrs(accountId, obs);
    }),
    delete: Effect.fn(function* () {
        // The default device profile cannot be deleted. Drop our state
        // and leave the cloud profile in place.
        yield* Effect.logWarning("Cloudflare.Devices.DefaultProfile: delete is a no-op; the default device profile cannot be deleted.");
        return Effect.void;
    }),
    read: Effect.fn(function* () {
        const { accountId } = yield* yield* CloudflareEnvironment;
        const obs = yield* observe();
        return buildAttrs(accountId, obs);
    }),
    // Account-scoped singleton: there is exactly one default device profile
    // per account and no enumeration API. Mirror `read` and return the single
    // profile as a one-element array.
    list: Effect.fn(function* () {
        const { accountId } = yield* yield* CloudflareEnvironment;
        const obs = yield* observe();
        return [buildAttrs(accountId, obs)];
    }),
});
// Cloudflare returns `{result: null, success: true}` (NOT `[]`) when
// a default-policy list endpoint is empty, and distilled's schema
// rejects that as a transport error. Swallow into `undefined` so the
// reconciler treats an empty list as "no entries" rather than failing.
const listOrEmpty = (op) => op.pipe(Effect.catch(() => Effect.succeed({
    result: [],
})));
const observe = Effect.fn(function* () {
    const { accountId } = yield* yield* CloudflareEnvironment;
    const [profile, include, exclude, fallback] = yield* Effect.all([
        zeroTrust.getDevicePolicyDefault({ accountId }),
        listOrEmpty(zeroTrust.getDevicePolicyDefaultInclude({ accountId })),
        listOrEmpty(zeroTrust.getDevicePolicyDefaultExclude({ accountId })),
        listOrEmpty(zeroTrust.getDevicePolicyDefaultFallbackDomain({ accountId })),
    ], { concurrency: "unbounded" });
    const inc = (include.result ?? []).map(normalizeSplit);
    const exc = (exclude.result ?? []).map(normalizeSplit);
    const fb = (fallback.result ?? []).map(normalizeFallback);
    return {
        profile,
        splitTunnelInclude: inc,
        splitTunnelExclude: exc,
        fallbackDomains: fb,
    };
});
const buildAttrs = (accountId, obs) => {
    const { profile } = obs;
    const sm = profile.serviceModeV2;
    const serviceModeV2 = sm && sm.mode != null
        ? {
            mode: (sm.mode === "proxy" ? "proxy" : "warp"),
            port: denull(sm.port),
        }
        : undefined;
    return {
        accountId,
        mode: inferMode(profile),
        splitTunnelInclude: obs.splitTunnelInclude,
        splitTunnelExclude: obs.splitTunnelExclude,
        fallbackDomains: obs.fallbackDomains,
        captivePortal: denull(profile.captivePortal),
        autoConnect: denull(profile.autoConnect),
        allowedToLeave: denull(profile.allowedToLeave),
        allowModeSwitch: denull(profile.allowModeSwitch),
        allowUpdates: denull(profile.allowUpdates),
        disableAutoFallback: denull(profile.disableAutoFallback),
        excludeOfficeIps: denull(profile.excludeOfficeIps),
        switchLocked: denull(profile.switchLocked),
        serviceModeV2,
        // lanAllow* are PATCH-only — GET does not echo them back.
        lanAllowMinutes: undefined,
        lanAllowSubnetSize: undefined,
        registerInterfaceIpWithDns: denull(profile.registerInterfaceIpWithDns),
        sccmVpnBoundarySupport: denull(profile.sccmVpnBoundarySupport),
        supportUrl: denull(profile.supportUrl),
        tunnelProtocol: denull(profile.tunnelProtocol),
    };
};
/**
 * Strip Cloudflare's `null` echoes to `undefined` so structural equality
 * (`JSON.stringify`) works.
 */
const denull = (v) => v == null ? undefined : v;
const normalizeSplit = (entry) => ({
    address: "address" in entry ? entry.address : "",
    host: "host" in entry ? entry.host : undefined,
    description: denull(entry.description),
});
const normalizeFallback = (entry) => ({
    suffix: entry.suffix,
    description: denull(entry.description),
    dnsServer: denull(entry.dnsServer),
});
/**
 * Encode a SplitTunnelEntry for the API's union shape (`address` OR `host`).
 * Prefers `host` when set since the address would otherwise be empty.
 */
const encodeSplit = (e) => {
    if (e.host && !e.address) {
        return e.description !== undefined
            ? { host: e.host, description: e.description }
            : { host: e.host };
    }
    return e.description !== undefined
        ? { address: e.address, description: e.description }
        : { address: e.address };
};
const encodeFallback = (d) => {
    const out = {
        suffix: d.suffix,
    };
    if (d.description !== undefined)
        out.description = d.description;
    if (d.dnsServer !== undefined)
        out.dnsServer = d.dnsServer;
    return out;
};
/** Structural deep-equality via canonical JSON. */
const sameJSON = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const inferMode = (observed) => observed.include && observed.include.length > 0 ? "include" : "exclude";
//# sourceMappingURL=DefaultProfile.js.map