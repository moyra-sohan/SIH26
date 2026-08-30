import * as zeroTrust from "@distilled.cloud/cloudflare/zero-trust";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Stream from "effect/Stream";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
import { CloudflareEnvironment } from "../CloudflareEnvironment.js";
/**
 * Routing configuration for a remotely-managed Cloudflare Tunnel.
 *
 * Cloudflare exposes the cfd_tunnel configuration as a single PUT-style
 * document per tunnel — `ingress` rules in order, plus optional default
 * `originRequest` settings. This resource owns that document; it is the
 * declarative equivalent of editing a tunnel's Public Hostname or Private
 * Hostname rules in the Zero Trust dashboard.
 *
 * The catch-all rule (final ingress entry with no hostname) is appended
 * automatically — Cloudflare rejects PUTs whose last rule has a hostname,
 * and forgetting it is a common foot-gun. Override the auto-appended
 * service via {@link ConfigurationProps.catchAllService}.
 * ### Routing a private hostname through a tunnel
 * **Example:** Map an internal admin UI through a Cloudflare Tunnel to a K8s Service
 * ```typescript
 * yield* Cloudflare.Tunnel.Configuration("AdminIngress", {
 *   tunnelId: tunnel.tunnelId,
 *   ingress: [
 *     {
 *       hostname: "cluster-admin.microagi",
 *       service: "http://research-ui.admin.svc.cluster.local:80",
 *     },
 *   ],
 * });
 * ```
 *
 * ### Multiple hostnames + custom catch-all
 * **Example:** Two services on one tunnel, returning 503 for unknown hosts
 * ```typescript
 * yield* Cloudflare.Tunnel.Configuration("Ingress", {
 *   tunnelId: tunnel.tunnelId,
 *   ingress: [
 *     { hostname: "ui.internal", service: "http://ui.app.svc.cluster.local:80" },
 *     { hostname: "api.internal", service: "http://api.app.svc.cluster.local:8080" },
 *   ],
 *   catchAllService: "http_status:503",
 * });
 * ```
 *
 * @resource
 * @product Tunnels
 * @category Cloudflare One (Zero Trust)
 */
export const Configuration = Resource("Cloudflare.Tunnel.Configuration");
const undef = (v) => v == null ? undefined : v;
const stripNulls = (v) => {
    if (Array.isArray(v))
        return v.map(stripNulls);
    if (v !== null && typeof v === "object") {
        const out = {};
        for (const [k, val] of Object.entries(v)) {
            if (val === null || val === undefined)
                continue;
            out[k] = stripNulls(val);
        }
        return out;
    }
    return v;
};
const narrowConfig = (raw) => ({
    ingress: raw.config?.ingress == null
        ? undefined
        : raw.config.ingress.map((r) => ({
            hostname: undef(r.hostname),
            service: r.service,
            path: undef(r.path),
            originRequest: undef(r.originRequest),
        })),
    originRequest: undef(raw.config?.originRequest),
    version: undef(raw.version),
});
// ---------------------------------------------------------------------------
// Body construction
// ---------------------------------------------------------------------------
const DEFAULT_CATCH_ALL_SERVICE = "http_status:404";
const buildIngress = (rules, catchAllService) => {
    const out = [];
    for (const r of rules) {
        // Drop any catch-all the caller threaded into the middle — we always
        // append exactly one trailing catch-all of our own, and a mid-list
        // catch-all would short-circuit every following rule anyway.
        if (r.hostname === undefined && r.path === undefined)
            continue;
        out.push(r);
    }
    out.push({ service: catchAllService });
    return out;
};
// ---------------------------------------------------------------------------
// Drift detection
//
// Cloudflare echoes back a config object with every optional field filled in
// (often as `null`). Strip nulls before comparing so a server-supplied
// `path: null` doesn't endlessly diff against an unset desired `path`.
// ---------------------------------------------------------------------------
const configsEqual = (desiredIngress, desiredOrigin, observed) => {
    const left = stripNulls({
        ingress: desiredIngress,
        originRequest: desiredOrigin,
    });
    const right = stripNulls({
        ingress: observed.ingress ?? [],
        originRequest: observed.originRequest,
    });
    return JSON.stringify(left) === JSON.stringify(right);
};
// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------
export const ConfigurationProvider = () => Provider.effect(Configuration, Effect.gen(function* () {
    const env = yield* CloudflareEnvironment;
    const getConfig = yield* zeroTrust.getTunnelCloudflaredConfiguration;
    const putConfig = yield* zeroTrust.putTunnelCloudflaredConfiguration;
    const observe = (accountId, tunnelId) => Effect.gen(function* () {
        // A tunnel with no configuration yet surfaces as the tagged
        // `TunnelConfigurationNotFound` (code 1055) — swallow into "missing".
        const r = yield* getConfig({ accountId, tunnelId }).pipe(Effect.catchTag("TunnelConfigurationNotFound", () => Effect.succeed(undefined)));
        if (r === undefined)
            return undefined;
        return narrowConfig(r);
    });
    return {
        stables: ["tunnelId", "accountId"],
        diff: Effect.fn(function* ({ olds = {}, news }) {
            // tunnelId is statically declared as Input<string>; by reconcile
            // time both sides resolve to strings. A change replaces because
            // a tunnel's configuration is keyed by tunnelId in the URL.
            const oldId = olds.tunnelId;
            const newId = news.tunnelId;
            if (typeof oldId === "string" &&
                typeof newId === "string" &&
                oldId !== newId) {
                return { action: "replace" };
            }
        }),
        reconcile: Effect.fn(function* ({ news }) {
            const { accountId } = yield* env;
            // Inputs have been resolved to concrete strings by the Plan layer.
            const tunnelId = news.tunnelId;
            const catchAllService = news.catchAllService ?? DEFAULT_CATCH_ALL_SERVICE;
            const desiredIngress = buildIngress(news.ingress, catchAllService);
            // Observe — falls through to a PUT if the tunnel has no config yet.
            let observed = yield* observe(accountId, tunnelId);
            // Sync — skip the PUT entirely when observed equals desired.
            if (observed === undefined ||
                !configsEqual(desiredIngress, news.originRequest, observed)) {
                const updated = yield* putConfig({
                    accountId,
                    tunnelId,
                    config: {
                        ingress: desiredIngress.map((r) => ({
                            hostname: r.hostname,
                            service: r.service,
                            path: r.path,
                            originRequest: r.originRequest,
                        })),
                        originRequest: news.originRequest,
                    },
                });
                observed = narrowConfig(updated);
            }
            return {
                tunnelId,
                accountId,
                version: observed.version,
            };
        }),
        delete: Effect.fn(function* ({ output }) {
            // Cloudflare's API has no DELETE for the configuration document —
            // PUT the catch-all-only shape so the tunnel stops routing
            // anything and idempotently converges.
            yield* putConfig({
                accountId: output.accountId,
                tunnelId: output.tunnelId,
                config: {
                    ingress: [{ service: DEFAULT_CATCH_ALL_SERVICE }],
                },
            }).pipe(Effect.catch(() => Effect.void));
        }),
        read: Effect.fn(function* ({ output }) {
            if (!output)
                return undefined;
            const observed = yield* observe(output.accountId, output.tunnelId);
            if (observed === undefined)
                return undefined;
            return {
                tunnelId: output.tunnelId,
                accountId: output.accountId,
                version: observed.version,
            };
        }),
        // The configuration is a per-tunnel singleton with no account-wide
        // enumeration API — fan out from the parent. Enumerate every
        // (non-deleted) cfd_tunnel in the account, then read each tunnel's
        // configuration document with bounded concurrency. Tunnels without a
        // config (`TunnelConfigurationNotFound`, handled inside `observe`) are
        // skipped, exactly mirroring `read`.
        list: () => Effect.gen(function* () {
            const { accountId } = yield* env;
            const tunnelIds = yield* zeroTrust.listTunnelCloudflareds
                .pages({ accountId, isDeleted: false })
                .pipe(Stream.runCollect, Effect.map((chunk) => Array.from(chunk).flatMap((page) => (page.result ?? []).flatMap((t) => t.id != null && t.deletedAt == null ? [t.id] : []))));
            const rows = yield* Effect.forEach(tunnelIds, (tunnelId) => observe(accountId, tunnelId).pipe(Effect.map((observed) => observed === undefined
                ? undefined
                : {
                    tunnelId,
                    accountId,
                    version: observed.version,
                })), { concurrency: 10 });
            return rows.filter((row) => row !== undefined);
        }),
    };
}));
void Option.none;
//# sourceMappingURL=Configuration.js.map