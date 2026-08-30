import * as zaraz from "@distilled.cloud/cloudflare/zaraz";
import * as Effect from "effect/Effect";
import { deepEqual, isResolved } from "../../Diff.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
import { stripNullFields, stripUndefinedFields, unwrapRedacted, } from "../../Util/data.js";
import { CloudflareEnvironment } from "../CloudflareEnvironment.js";
import { resolveZoneId } from "../Zone/index.js";
import { listAllZones } from "../Zone/lookup.js";
import { defineZarazEvents } from "./ZarazEventTypes.js";
/**
 * A Cloudflare Zaraz zone configuration.
 *
 * Cloudflare Zaraz is an edge-managed third-party tool manager and analytics
 * event pipeline. See the
 * {@link https://developers.cloudflare.com/zaraz/ | Cloudflare Zaraz docs} and
 * {@link https://developers.cloudflare.com/zaraz/web-api/ | Web API docs}.
 *
 * Zaraz is a zone-level singleton. This resource reconciles the current zone
 * config and workflow to the desired values while retaining existing settings
 * for fields omitted from props.
 *
 * Destroy keeps the current Zaraz config by default to avoid wiping unrelated
 * zone-level analytics setup. Set `delete: true` to restore Cloudflare's
 * default Zaraz config on destroy.
 * ### Managing Zaraz
 * **Example:** Enable data layer compatibility
 * ```typescript
 * const zaraz = yield* Cloudflare.Zaraz.Config("Analytics", {
 *   zone: "example.com",
 *   dataLayer: true,
 * });
 * ```
 *
 * **Example:** Update Zaraz settings
 * ```typescript
 * const zaraz = yield* Cloudflare.Zaraz.Config("Analytics", {
 *   zone: "example.com",
 *   settings: {
 *     autoInjectScript: true,
 *     hideIPAddress: true,
 *   },
 * });
 * ```
 *
 * **Example:** Enable preview workflow
 * ```typescript
 * const zaraz = yield* Cloudflare.Zaraz.Config("Analytics", {
 *   zone: "example.com",
 *   workflow: "preview",
 * });
 * ```
 *
 * @resource
 * @product Zaraz
 * @category Performance & Reliability
 */
export const Config = Object.assign(Resource("Cloudflare.Zaraz.Config", {
    aliases: ["Cloudflare.ZarazConfig"],
}), {
    /**
     * Define a type-only contract for the events sent through this Zaraz config.
     *
     * The returned value carries only types. Browser code should use
     * Cloudflare's injected `window.zaraz` API at runtime.
     */
    events: defineZarazEvents,
});
export const ConfigProvider = () => Provider.succeed(Config, {
    nuke: { singleton: true },
    stables: ["zoneId"],
    list: Effect.fn(function* () {
        const { accountId } = yield* yield* CloudflareEnvironment;
        // Zaraz config is a zone-level singleton with no account-wide list
        // API — enumerate every zone and read its config (one per zone).
        const allZones = yield* listAllZones(accountId);
        const rows = yield* Effect.forEach(allZones.map((zone) => zone.id), (zoneId) => observe(zoneId).pipe(
        // Best-effort account-wide fan-out: a zone where Zaraz isn't
        // provisioned (rejects the route) or that the token can't read
        // (missing permission / code-10000 auth blip surfaced as
        // Unauthorized, or a 403/404) must be skipped, not fail the whole
        // enumeration.
        Effect.catchTag(["InvalidRoute", "Unauthorized", "Forbidden", "NotFound"], () => Effect.succeed(undefined))), { concurrency: 10 });
        return rows.filter((row) => row !== undefined);
    }),
    diff: Effect.fn(function* ({ olds, news, output }) {
        if (!output)
            return undefined;
        if (!isResolved(news))
            return undefined;
        const zoneId = yield* resolve(news.zone);
        if (zoneId !== output.zoneId) {
            return { action: "replace" };
        }
        const outputConfig = fromAttributes(output);
        const comparableOutput = configForCompare(outputConfig, olds, news);
        const desired = desiredConfig(outputConfig, news);
        const desiredWorkflow = news.workflow ?? output.workflow;
        if (desiredWorkflow !== output.workflow ||
            !deepEqual(comparableConfig(comparableOutput), comparableConfig(desired))) {
            return { action: "update" };
        }
    }),
    read: Effect.fn(function* ({ olds, output }) {
        const zoneId = 
        // `olds.zone` may be `undefined` when a `creating` row was persisted
        // before upstream Outputs resolved — report "not found" then.
        output?.zoneId ??
            (olds?.zone !== undefined ? yield* resolve(olds.zone) : undefined);
        if (!zoneId)
            return undefined;
        return yield* observe(zoneId);
    }),
    reconcile: Effect.fn(function* ({ news, output }) {
        const zoneId = output?.zoneId ?? (yield* resolve(news.zone));
        const observed = yield* observe(zoneId);
        const observedConfig = fromAttributes(observed);
        const desired = desiredConfig(observedConfig, news);
        const desiredWorkflow = news.workflow ?? observed.workflow;
        const updatedConfig = deepEqual(comparableConfig(observedConfig), comparableConfig(desired))
            ? observedConfig
            : yield* zaraz.putConfig(toPutConfig(zoneId, desired));
        const updatedWorkflow = desiredWorkflow === observed.workflow
            ? observed.workflow
            : yield* zaraz.putZaraz({
                zoneId,
                workflow: desiredWorkflow,
            });
        return toAttributes(zoneId, updatedConfig, updatedWorkflow);
    }),
    delete: Effect.fn(function* ({ output, olds }) {
        if (olds.delete !== true)
            return;
        const defaults = yield* zaraz.getDefault({ zoneId: output.zoneId });
        yield* zaraz.putConfig(toPutConfig(output.zoneId, defaults));
        if (olds.workflow !== undefined) {
            yield* zaraz.putZaraz({
                zoneId: output.zoneId,
                workflow: "realtime",
            });
        }
    }),
});
const resolve = Effect.fn(function* (zone) {
    const { accountId } = yield* yield* CloudflareEnvironment;
    return yield* resolveZoneId({
        accountId,
        zone,
        hostname: typeof zone === "string" ? zone : (zone.name ?? ""),
    });
});
const observe = (zoneId) => Effect.all({
    config: zaraz.getConfig({ zoneId }),
    workflow: zaraz.getWorkflow({ zoneId }),
}).pipe(Effect.map(({ config, workflow }) => toAttributes(zoneId, config, workflow)));
const toAttributes = (zoneId, config, workflow) => ({
    zoneId,
    dataLayer: config.dataLayer,
    debugKey: config.debugKey,
    settings: config.settings,
    tools: config.tools,
    triggers: config.triggers,
    variables: config.variables,
    zarazVersion: config.zarazVersion,
    analytics: config.analytics,
    consent: config.consent,
    historyChange: config.historyChange,
    workflow,
});
const fromAttributes = (attrs) => ({
    dataLayer: attrs.dataLayer,
    debugKey: attrs.debugKey,
    settings: attrs.settings,
    tools: attrs.tools,
    triggers: attrs.triggers,
    variables: attrs.variables,
    zarazVersion: attrs.zarazVersion,
    analytics: attrs.analytics,
    consent: attrs.consent,
    historyChange: attrs.historyChange,
});
const desiredConfig = (observed, props) => ({
    dataLayer: props.dataLayer ?? observed.dataLayer,
    debugKey: props.debugKey ?? observed.debugKey,
    settings: {
        ...stripNullFields(observed.settings),
        ...props.settings,
    },
    tools: props.tools ?? observed.tools,
    triggers: props.triggers ?? observed.triggers,
    variables: props.variables ?? observed.variables,
    zarazVersion: observed.zarazVersion,
    analytics: props.analytics ??
        (observed.analytics ? stripNullFields(observed.analytics) : undefined),
    consent: props.consent ??
        (observed.consent ? stripNullFields(observed.consent) : undefined),
    historyChange: props.historyChange ?? observed.historyChange,
});
const toPutConfig = (zoneId, config) => stripUndefinedFields({
    zoneId,
    dataLayer: config.dataLayer,
    debugKey: config.debugKey,
    settings: stripNullFields(config.settings),
    tools: unwrapRedacted(config.tools),
    triggers: unwrapRedacted(config.triggers),
    variables: unwrapRedacted(config.variables),
    zarazVersion: config.zarazVersion,
    analytics: config.analytics
        ? stripNullFields(config.analytics)
        : undefined,
    consent: config.consent
        ? stripNullFields(config.consent)
        : undefined,
    historyChange: config.historyChange ?? undefined,
});
const comparableConfig = (config) => {
    const { zoneId: _, ...request } = toPutConfig("", config);
    return request;
};
const configForCompare = (observed, oldProps, props) => {
    if (props.variables === undefined ||
        oldProps?.variables === undefined ||
        !deepEqual(oldProps.variables, props.variables)) {
        return observed;
    }
    // If props already requested these variables in the previous state, compare
    // against props instead of Cloudflare's readback because secret variable
    // values are intentionally write-only in the Zaraz API.
    return {
        ...observed,
        variables: props.variables,
    };
};
//# sourceMappingURL=Config.js.map