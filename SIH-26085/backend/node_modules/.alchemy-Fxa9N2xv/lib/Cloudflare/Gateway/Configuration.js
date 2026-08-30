import * as zeroTrust from "@distilled.cloud/cloudflare/zero-trust";
import * as Effect from "effect/Effect";
import * as Predicate from "effect/Predicate";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
import { CloudflareEnvironment } from "../CloudflareEnvironment.js";
const TypeId = "Cloudflare.Gateway.Configuration";
/**
 * Manages the **singleton** Cloudflare Zero Trust **Gateway configuration**
 * for an account (`/accounts/{accountId}/gateway/configuration`) —
 * account-wide settings like activity logging, TLS decryption, the block
 * page, anti-virus scanning, and browser isolation.
 *
 * The singleton always exists, so reconcile patches only the settings
 * blocks you declare and never clobbers unmanaged blocks. The
 * pre-management value of each managed block is captured on first touch
 * and restored on destroy (capture-and-restore). Blocks that were unset
 * before Alchemy managed them cannot be restored (Cloudflare's API has no
 * way to unset a block) — destroy leaves the last managed value and logs
 * a warning.
 * ### Managing Gateway settings
 * **Example:** Enable activity logging and TLS decryption
 * ```typescript
 * yield* Cloudflare.Gateway.Configuration("Gateway", {
 *   settings: {
 *     activityLog: { enabled: true },
 *     tlsDecrypt: { enabled: true },
 *   },
 * });
 * ```
 *
 * **Example:** Custom block page
 * ```typescript
 * yield* Cloudflare.Gateway.Configuration("Gateway", {
 *   settings: {
 *     blockPage: {
 *       enabled: true,
 *       headerText: "Blocked by IT",
 *       footerText: "Contact support@example.com",
 *       backgroundColor: "#1f2937",
 *     },
 *   },
 * });
 * ```
 *
 * ### TLS interception
 * **Example:** Use a Gateway certificate for inspection
 * ```typescript
 * const cert = yield* Cloudflare.Gateway.Certificate("InspectionCa", {});
 * yield* Cloudflare.Gateway.Configuration("Gateway", {
 *   settings: {
 *     tlsDecrypt: { enabled: true },
 *     certificate: { id: cert.certificateId },
 *   },
 * });
 * ```
 *
 * @see https://developers.cloudflare.com/cloudflare-one/policies/gateway/
 *
 * @resource
 * @product Gateway
 * @category Cloudflare One (Zero Trust)
 */
export const Configuration = Resource(TypeId);
/**
 * Returns true if the given value is a Configuration resource.
 */
export const isConfiguration = (value) => Predicate.hasProperty(value, "Type") && value.Type === TypeId;
export const ConfigurationProvider = () => Provider.succeed(Configuration, {
    nuke: { singleton: true },
    stables: ["accountId", "initialSettings", "createdAt"],
    // Account-wide singleton: the Gateway configuration always exists for
    // the ambient account, so enumeration is a single read returning a
    // one-element array. There is no prior management context, so the
    // restore snapshot is empty.
    list: Effect.fn(function* () {
        const { accountId } = yield* yield* CloudflareEnvironment;
        const observed = yield* zeroTrust.getGatewayConfiguration({
            accountId,
        });
        return [toAttributes(accountId, observed, {})];
    }),
    read: Effect.fn(function* ({ output, olds }) {
        const { accountId } = yield* yield* CloudflareEnvironment;
        const acct = output?.accountId ?? accountId;
        const observed = yield* zeroTrust.getGatewayConfiguration({
            accountId: acct,
        });
        // The singleton always exists with account defaults — there is
        // nothing to "own", so a cold read adopts freely. The observed
        // blocks at adoption time become the restore target.
        const managed = managedKeys(olds?.settings ?? {});
        const initialSettings = output?.initialSettings ??
            captureBlocks(observed.settings ?? {}, managed);
        return toAttributes(acct, observed, initialSettings);
    }),
    reconcile: Effect.fn(function* ({ news, output }) {
        const { accountId } = yield* yield* CloudflareEnvironment;
        const desired = (news.settings ?? {});
        const managed = managedKeys(desired);
        // 1. Observe — the singleton always exists; read its live state.
        const observed = yield* zeroTrust.getGatewayConfiguration({ accountId });
        const observedSettings = (observed.settings ?? {});
        // 2. Capture — pre-management values for every managed block,
        //    restored on destroy. Blocks newly managed by this update are
        //    captured now; previously captured blocks keep their original
        //    snapshot.
        const initialSettings = {
            ...captureBlocks(observedSettings, managed),
            ...output?.initialSettings,
        };
        // 3. Sync — patch only when a declared block diverges from the
        //    observed state; skip the API entirely on a no-op. PATCH
        //    replaces each provided block wholly and leaves the rest alone.
        const dirty = managed.some((key) => !subsetEquals(desired[key], observedSettings[key]));
        if (!dirty) {
            return toAttributes(accountId, observed, initialSettings);
        }
        yield* zeroTrust.patchGatewayConfiguration({
            accountId,
            settings: pickBlocks(desired, managed),
        });
        // 4. Return — re-read so attrs reflect post-sync truth.
        const final = yield* zeroTrust.getGatewayConfiguration({ accountId });
        return toAttributes(accountId, final, initialSettings);
    }),
    delete: Effect.fn(function* ({ output }) {
        const { accountId, initialSettings } = output;
        const managed = Object.keys(initialSettings);
        if (managed.length === 0)
            return;
        // Observe — restore only the blocks that still diverge from their
        // captured pre-management value (idempotent re-delete).
        const observed = yield* zeroTrust.getGatewayConfiguration({ accountId });
        const observedSettings = (observed.settings ?? {});
        const restore = {};
        for (const key of managed) {
            const initial = sanitizeBlock(initialSettings[key]);
            const current = sanitizeBlock(observedSettings[key]);
            if (deepEquals(initial ?? null, current ?? null))
                continue;
            if (initial === undefined) {
                // The block was absent before we managed it. Cloudflare's PATCH
                // ignores `null` blocks, so an absent block cannot be restored —
                // the last managed value is left in place.
                yield* Effect.logWarning(`Gateway configuration block "${key}" was unset before Alchemy managed it and cannot be restored; leaving the current value in place.`);
                continue;
            }
            restore[key] = initial;
        }
        if (Object.keys(restore).length === 0)
            return;
        yield* zeroTrust.patchGatewayConfiguration({
            accountId,
            settings: restore,
        });
    }),
});
const managedKeys = (settings) => Object.keys(settings).filter((key) => settings[key] !== undefined);
/**
 * Capture the observed value of each managed block (read-only fields
 * stripped so the snapshot can be patched straight back). Absent blocks
 * are recorded as `null`; they cannot be restored on destroy because
 * Cloudflare's PATCH ignores `null` blocks.
 */
const captureBlocks = (observedSettings, keys) => {
    const snapshot = {};
    for (const key of keys) {
        snapshot[key] = sanitizeBlock(observedSettings[key]) ?? null;
    }
    return snapshot;
};
const pickBlocks = (settings, keys) => {
    const picked = {};
    for (const key of keys)
        picked[key] = settings[key];
    return picked;
};
/**
 * Read-only fields Cloudflare reports on settings blocks that the PATCH
 * endpoint does not accept back.
 */
const READ_ONLY_FIELDS = new Set([
    "readOnly",
    "sourceAccount",
    "version",
    "bindingStatus",
    "updatedAt",
]);
/**
 * Strip read-only fields and `null`-valued leaves from an observed block
 * so it can be compared with (and patched back as) a desired block.
 */
const sanitizeBlock = (block) => {
    if (block === null || block === undefined)
        return undefined;
    if (Array.isArray(block))
        return block.map(sanitizeBlock);
    if (typeof block === "object") {
        const out = {};
        for (const [k, v] of Object.entries(block)) {
            if (READ_ONLY_FIELDS.has(k))
                continue;
            if (v === null || v === undefined)
                continue;
            out[k] = sanitizeBlock(v);
        }
        return out;
    }
    return block;
};
/**
 * True when every field declared in `desired` matches `observed`
 * (recursively). Fields the user did not declare are ignored, so an
 * observed block carrying extra server-side fields still counts as
 * converged.
 */
const subsetEquals = (desired, observed) => {
    if (desired === undefined)
        return true;
    if (desired !== null &&
        typeof desired === "object" &&
        !Array.isArray(desired)) {
        if (observed === null || observed === undefined)
            return false;
        if (typeof observed !== "object" || Array.isArray(observed))
            return false;
        return Object.entries(desired).every(([k, v]) => subsetEquals(v, observed[k]));
    }
    return deepEquals(desired, observed ?? null);
};
const deepEquals = (a, b) => {
    if (a === b)
        return true;
    if (a === null || b === null)
        return false;
    if (Array.isArray(a) || Array.isArray(b)) {
        if (!Array.isArray(a) || !Array.isArray(b))
            return false;
        if (a.length !== b.length)
            return false;
        return a.every((v, i) => deepEquals(v, b[i]));
    }
    if (typeof a === "object" && typeof b === "object") {
        const ak = Object.keys(a);
        const bk = Object.keys(b);
        if (ak.length !== bk.length)
            return false;
        return ak.every((k) => deepEquals(a[k], b[k]));
    }
    return false;
};
const toAttributes = (accountId, observed, initialSettings) => ({
    accountId,
    settings: observed.settings ?? {},
    initialSettings,
    createdAt: observed.createdAt ?? undefined,
    updatedAt: observed.updatedAt ?? undefined,
});
//# sourceMappingURL=Configuration.js.map