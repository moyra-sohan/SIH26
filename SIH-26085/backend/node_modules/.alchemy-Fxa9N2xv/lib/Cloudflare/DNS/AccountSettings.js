import * as dns from "@distilled.cloud/cloudflare/dns";
import * as Effect from "effect/Effect";
import * as Predicate from "effect/Predicate";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
import { CloudflareEnvironment } from "../CloudflareEnvironment.js";
const TypeId = "Cloudflare.DNS.AccountSettings";
/**
 * The DNS settings of a Cloudflare account
 * (`/accounts/{account_id}/dns_settings`) — the account-wide
 * `enforceDnsOnly` override and the default DNS settings applied to
 * every new zone (`zoneDefaults`).
 *
 * The settings object is a per-account singleton — it always exists
 * with Cloudflare defaults, so this resource never creates or deletes
 * anything physical. Reconcile patches only the fields you declare
 * (and only when the observed value differs); destroy restores the
 * managed fields to the values they had before Alchemy first touched
 * the account (captured as `initialSettings`).
 *
 * Some fields are plan-gated: `zoneDefaults.nsTtl` and custom SOA
 * values require the custom nameserver TTL / custom SOA entitlements,
 * `foundationDns` is a paid add-on, and `internalDns` is Enterprise
 * Internal DNS only.
 * ### Account-wide overrides
 * **Example:** Force every proxied record to DNS-only
 * ```typescript
 * yield* Cloudflare.DNS.AccountDnsSettings("DnsSettings", {
 *   enforceDnsOnly: true,
 * });
 * ```
 *
 * ### Zone defaults
 * **Example:** Flatten CNAMEs in every new zone
 * ```typescript
 * yield* Cloudflare.DNS.AccountDnsSettings("DnsSettings", {
 *   zoneDefaults: { flattenAllCnames: true },
 * });
 * ```
 *
 * **Example:** Default new zones to multi-provider DNS
 * ```typescript
 * yield* Cloudflare.DNS.AccountDnsSettings("DnsSettings", {
 *   zoneDefaults: { multiProvider: true },
 * });
 * ```
 *
 * @resource
 * @product DNS
 * @category Domains & DNS
 */
export const AccountDnsSettings = Resource(TypeId, {
    aliases: ["Cloudflare.Dns.AccountSettings"],
});
/**
 * Returns true if the given value is an AccountDnsSettings resource.
 */
export const isAccountDnsSettings = (value) => Predicate.hasProperty(value, "Type") && value.Type === TypeId;
export const AccountDnsSettingsProvider = () => Provider.succeed(AccountDnsSettings, {
    stables: ["accountId", "initialSettings", "managedKeys"],
    // Account singleton — the DNS settings object always exists for the
    // ambient account. There is no enumeration API, so read the single
    // object and return it as a one-element array (mirrors `read` with no
    // prior output: the observed snapshot is its own `initialSettings`,
    // nothing is being managed yet).
    list: Effect.fn(function* () {
        const { accountId } = yield* yield* CloudflareEnvironment;
        const observed = yield* dns.getSettingAccount({ accountId });
        const snapshot = toSnapshot(observed);
        return [
            {
                accountId,
                ...snapshot,
                initialSettings: snapshot,
                managedKeys: [],
            },
        ];
    }),
    diff: Effect.fn(function* ({ output }) {
        const { accountId } = yield* yield* CloudflareEnvironment;
        // The settings object is an account singleton — a different
        // account is a different resource.
        if (output !== undefined && output.accountId !== accountId) {
            return { action: "replace" };
        }
        return undefined;
    }),
    read: Effect.fn(function* ({ output }) {
        const { accountId } = yield* yield* CloudflareEnvironment;
        const acct = output?.accountId ?? accountId;
        const observed = yield* dns.getSettingAccount({ accountId: acct });
        const snapshot = toSnapshot(observed);
        // Settings are a singleton that always exists with Cloudflare
        // defaults — there is nothing to "own", so a cold read adopts
        // freely (never `Unowned`). The observed snapshot at adoption
        // time becomes the baseline restored on destroy.
        return {
            accountId: acct,
            ...snapshot,
            initialSettings: output?.initialSettings ?? snapshot,
            managedKeys: output?.managedKeys ?? [],
        };
    }),
    reconcile: Effect.fn(function* ({ news, output }) {
        const { accountId } = yield* yield* CloudflareEnvironment;
        // 1. Observe — the settings object always exists for an account.
        const observed = yield* dns.getSettingAccount({ accountId });
        let snapshot = toSnapshot(observed);
        // 2. Capture — the pre-management snapshot, restored on destroy.
        const initialSettings = output?.initialSettings ?? snapshot;
        // Track every key we have ever managed so destroy restores fields
        // even after the user drops them from props.
        const managedKeys = [
            ...new Set([...(output?.managedKeys ?? []), ...declaredKeys(news)]),
        ].sort();
        // 3. Sync — patch only the declared fields whose observed value
        //    differs from the desired one; skip the API on no delta.
        const delta = computeDelta(news, snapshot);
        if (delta !== undefined) {
            const patched = yield* dns.patchSettingAccount({
                accountId,
                ...delta,
            });
            snapshot = toSnapshot(patched);
        }
        return {
            accountId,
            ...snapshot,
            initialSettings,
            managedKeys,
        };
    }),
    delete: Effect.fn(function* ({ output }) {
        const { accountId, initialSettings, managedKeys } = output;
        // Observe, then restore only the fields this resource managed,
        // and only the ones that still differ (idempotent re-delete after
        // a crash).
        const observed = yield* dns.getSettingAccount({ accountId });
        const snapshot = toSnapshot(observed);
        const restore = computeRestore(managedKeys, initialSettings, snapshot);
        if (restore === undefined)
            return;
        yield* dns.patchSettingAccount({ accountId, ...restore });
    }),
});
const undef = (v) => v == null ? undefined : v;
const toSnapshot = (r) => ({
    enforceDnsOnly: undef(r.enforceDnsOnly) ?? false,
    zoneDefaults: {
        flattenAllCnames: r.zoneDefaults.flattenAllCnames,
        foundationDns: r.zoneDefaults.foundationDns,
        internalDns: {
            referenceZoneId: undef(r.zoneDefaults.internalDns.referenceZoneId),
        },
        multiProvider: r.zoneDefaults.multiProvider,
        nameservers: { type: r.zoneDefaults.nameservers.type },
        nsTtl: r.zoneDefaults.nsTtl,
        secondaryOverrides: r.zoneDefaults.secondaryOverrides,
        soa: {
            expire: undef(r.zoneDefaults.soa.expire),
            minTtl: undef(r.zoneDefaults.soa.minTtl),
            mname: undef(r.zoneDefaults.soa.mname),
            refresh: undef(r.zoneDefaults.soa.refresh),
            retry: undef(r.zoneDefaults.soa.retry),
            rname: undef(r.zoneDefaults.soa.rname),
            ttl: undef(r.zoneDefaults.soa.ttl),
        },
        zoneMode: r.zoneDefaults.zoneMode,
    },
});
const ZONE_DEFAULT_KEYS = [
    "flattenAllCnames",
    "foundationDns",
    "internalDns",
    "multiProvider",
    "nameservers",
    "nsTtl",
    "secondaryOverrides",
    "soa",
    "zoneMode",
];
/** Keys the user declared, e.g. `enforceDnsOnly`, `zoneDefaults.nsTtl`. */
const declaredKeys = (news) => [
    ...(news.enforceDnsOnly !== undefined ? ["enforceDnsOnly"] : []),
    ...ZONE_DEFAULT_KEYS.filter((k) => news.zoneDefaults?.[k] !== undefined).map((k) => `zoneDefaults.${k}`),
];
/**
 * Merge desired SOA subfields over the observed SOA so the PATCH always
 * carries a complete, consistent record (Cloudflare validates SOA as a
 * whole).
 */
const mergedSoa = (desired, observed) => ({
    expire: desired.expire ?? observed.expire,
    minTtl: desired.minTtl ?? observed.minTtl,
    mname: desired.mname ?? observed.mname,
    refresh: desired.refresh ?? observed.refresh,
    retry: desired.retry ?? observed.retry,
    rname: desired.rname ?? observed.rname,
    ttl: desired.ttl ?? observed.ttl,
});
const soaDiffers = (desired, observed) => (desired.expire !== undefined && desired.expire !== observed.expire) ||
    (desired.minTtl !== undefined && desired.minTtl !== observed.minTtl) ||
    (desired.mname !== undefined && desired.mname !== observed.mname) ||
    (desired.refresh !== undefined && desired.refresh !== observed.refresh) ||
    (desired.retry !== undefined && desired.retry !== observed.retry) ||
    (desired.rname !== undefined && desired.rname !== observed.rname) ||
    (desired.ttl !== undefined && desired.ttl !== observed.ttl);
/**
 * Build the PATCH body converging observed → desired for the fields the
 * user declared. Returns `undefined` when nothing differs.
 */
const computeDelta = (news, observed) => {
    const body = {};
    let dirty = false;
    if (news.enforceDnsOnly !== undefined &&
        news.enforceDnsOnly !== observed.enforceDnsOnly) {
        body.enforceDnsOnly = news.enforceDnsOnly;
        dirty = true;
    }
    const zd = news.zoneDefaults;
    const ozd = observed.zoneDefaults;
    if (zd !== undefined) {
        const zdBody = {};
        let zdDirty = false;
        if (zd.flattenAllCnames !== undefined &&
            zd.flattenAllCnames !== ozd.flattenAllCnames) {
            zdBody.flattenAllCnames = zd.flattenAllCnames;
            zdDirty = true;
        }
        if (zd.foundationDns !== undefined &&
            zd.foundationDns !== ozd.foundationDns) {
            zdBody.foundationDns = zd.foundationDns;
            zdDirty = true;
        }
        if (zd.internalDns?.referenceZoneId !== undefined &&
            zd.internalDns.referenceZoneId !== ozd.internalDns.referenceZoneId) {
            zdBody.internalDns = { referenceZoneId: zd.internalDns.referenceZoneId };
            zdDirty = true;
        }
        if (zd.multiProvider !== undefined &&
            zd.multiProvider !== ozd.multiProvider) {
            zdBody.multiProvider = zd.multiProvider;
            zdDirty = true;
        }
        if (zd.nameservers !== undefined &&
            zd.nameservers.type !== ozd.nameservers.type) {
            zdBody.nameservers = { type: zd.nameservers.type };
            zdDirty = true;
        }
        if (zd.nsTtl !== undefined && zd.nsTtl !== ozd.nsTtl) {
            zdBody.nsTtl = zd.nsTtl;
            zdDirty = true;
        }
        if (zd.secondaryOverrides !== undefined &&
            zd.secondaryOverrides !== ozd.secondaryOverrides) {
            zdBody.secondaryOverrides = zd.secondaryOverrides;
            zdDirty = true;
        }
        if (zd.soa !== undefined && soaDiffers(zd.soa, ozd.soa)) {
            zdBody.soa = mergedSoa(zd.soa, ozd.soa);
            zdDirty = true;
        }
        if (zd.zoneMode !== undefined && zd.zoneMode !== ozd.zoneMode) {
            zdBody.zoneMode = zd.zoneMode;
            zdDirty = true;
        }
        if (zdDirty) {
            body.zoneDefaults = zdBody;
            dirty = true;
        }
    }
    return dirty ? body : undefined;
};
/**
 * Build the PATCH body that restores the managed fields to their
 * pre-management values. Returns `undefined` when nothing drifted.
 */
const computeRestore = (managedKeys, initial, observed) => {
    const body = {};
    const zdBody = {};
    let dirty = false;
    let zdDirty = false;
    const izd = initial.zoneDefaults;
    const ozd = observed.zoneDefaults;
    for (const key of managedKeys) {
        switch (key) {
            case "enforceDnsOnly":
                if (initial.enforceDnsOnly !== observed.enforceDnsOnly) {
                    body.enforceDnsOnly = initial.enforceDnsOnly;
                    dirty = true;
                }
                break;
            case "zoneDefaults.flattenAllCnames":
                if (izd.flattenAllCnames !== ozd.flattenAllCnames) {
                    zdBody.flattenAllCnames = izd.flattenAllCnames;
                    zdDirty = true;
                }
                break;
            case "zoneDefaults.foundationDns":
                if (izd.foundationDns !== ozd.foundationDns) {
                    zdBody.foundationDns = izd.foundationDns;
                    zdDirty = true;
                }
                break;
            case "zoneDefaults.internalDns":
                if (izd.internalDns.referenceZoneId !== ozd.internalDns.referenceZoneId &&
                    izd.internalDns.referenceZoneId !== undefined) {
                    zdBody.internalDns = {
                        referenceZoneId: izd.internalDns.referenceZoneId,
                    };
                    zdDirty = true;
                }
                break;
            case "zoneDefaults.multiProvider":
                if (izd.multiProvider !== ozd.multiProvider) {
                    zdBody.multiProvider = izd.multiProvider;
                    zdDirty = true;
                }
                break;
            case "zoneDefaults.nameservers":
                if (izd.nameservers.type !== ozd.nameservers.type) {
                    zdBody.nameservers = { type: izd.nameservers.type };
                    zdDirty = true;
                }
                break;
            case "zoneDefaults.nsTtl":
                if (izd.nsTtl !== ozd.nsTtl) {
                    zdBody.nsTtl = izd.nsTtl;
                    zdDirty = true;
                }
                break;
            case "zoneDefaults.secondaryOverrides":
                if (izd.secondaryOverrides !== ozd.secondaryOverrides) {
                    zdBody.secondaryOverrides = izd.secondaryOverrides;
                    zdDirty = true;
                }
                break;
            case "zoneDefaults.soa":
                if (izd.soa.expire !== ozd.soa.expire ||
                    izd.soa.minTtl !== ozd.soa.minTtl ||
                    izd.soa.mname !== ozd.soa.mname ||
                    izd.soa.refresh !== ozd.soa.refresh ||
                    izd.soa.retry !== ozd.soa.retry ||
                    izd.soa.rname !== ozd.soa.rname ||
                    izd.soa.ttl !== ozd.soa.ttl) {
                    zdBody.soa = {
                        expire: izd.soa.expire,
                        minTtl: izd.soa.minTtl,
                        mname: izd.soa.mname,
                        refresh: izd.soa.refresh,
                        retry: izd.soa.retry,
                        rname: izd.soa.rname,
                        ttl: izd.soa.ttl,
                    };
                    zdDirty = true;
                }
                break;
            case "zoneDefaults.zoneMode":
                if (izd.zoneMode !== ozd.zoneMode) {
                    zdBody.zoneMode = izd.zoneMode;
                    zdDirty = true;
                }
                break;
            default:
                break;
        }
    }
    if (zdDirty) {
        body.zoneDefaults = zdBody;
        dirty = true;
    }
    return dirty ? body : undefined;
};
//# sourceMappingURL=AccountSettings.js.map