import * as logs from "@distilled.cloud/aws/cloudwatch-logs";
import * as rum from "@distilled.cloud/aws/rum";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Schedule from "effect/Schedule";
import * as Stream from "effect/Stream";
import { Unowned } from "../../AdoptPolicy.js";
import { isResolved } from "../../Diff.js";
import { createPhysicalName } from "../../PhysicalName.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
import { createInternalTags, diffTags, hasAlchemyTags } from "../../Tags.js";
import { AWSEnvironment } from "../Environment.js";
/**
 * An Amazon CloudWatch RUM app monitor that collects client-side telemetry
 * (page load times, JavaScript errors, user behavior) from your web
 * application.
 * ### Creating App Monitors
 * **Example:** Monitor a single domain
 * ```typescript
 * import * as RUM from "alchemy/AWS/RUM";
 *
 * const monitor = yield* RUM.AppMonitor("SiteMonitor", {
 *   domain: "example.com",
 * });
 * ```
 *
 * **Example:** Sample all sessions and collect every telemetry type
 * ```typescript
 * const monitor = yield* RUM.AppMonitor("SiteMonitor", {
 *   domain: "*.example.com",
 *   appMonitorConfiguration: {
 *     sessionSampleRate: 1,
 *     telemetries: ["errors", "performance", "http"],
 *     allowCookies: true,
 *   },
 * });
 * ```
 *
 * ### Log Retention and Custom Events
 * **Example:** Copy telemetry to CloudWatch Logs and accept custom events
 * ```typescript
 * const monitor = yield* RUM.AppMonitor("SiteMonitor", {
 *   domainList: ["example.com", "app.example.com"],
 *   cwLogEnabled: true,
 *   customEvents: "ENABLED",
 * });
 * ```
 *
 * @resource
 */
export const AppMonitor = Resource("AWS.RUM.AppMonitor");
/**
 * Raised when an `AppMonitor` is configured with both or neither of
 * `domain` / `domainList` — the API requires exactly one.
 */
export class RumAppMonitorInvalidDomains extends Data.TaggedError("RumAppMonitorInvalidDomains") {
}
const validateDomains = (props) => {
    const hasDomain = props.domain !== undefined;
    const hasDomainList = (props.domainList?.length ?? 0) > 0;
    if (hasDomain === hasDomainList) {
        return Effect.fail(new RumAppMonitorInvalidDomains({
            message: hasDomain
                ? "specify exactly one of domain or domainList, not both."
                : "an AppMonitor requires either domain or domainList.",
        }));
    }
    return Effect.void;
};
const sameStringList = (a, b) => {
    const left = [...(a ?? [])].sort();
    const right = [...(b ?? [])].sort();
    return left.length === right.length && left.every((v, i) => v === right[i]);
};
const desiredConfiguration = (props) => {
    const c = props.appMonitorConfiguration;
    if (c === undefined)
        return undefined;
    return {
        IdentityPoolId: c.identityPoolId,
        ExcludedPages: c.excludedPages,
        IncludedPages: c.includedPages,
        FavoritePages: c.favoritePages,
        SessionSampleRate: c.sessionSampleRate,
        GuestRoleArn: c.guestRoleArn,
        AllowCookies: c.allowCookies,
        Telemetries: c.telemetries,
        EnableXRay: c.enableXRay,
    };
};
/** Compares only the fields the user explicitly configured against the observed cloud state. */
const configurationInSync = (observed, desired) => {
    if (desired === undefined)
        return true;
    const o = observed ?? {};
    return ((desired.IdentityPoolId === undefined ||
        o.IdentityPoolId === desired.IdentityPoolId) &&
        (desired.ExcludedPages === undefined ||
            sameStringList(o.ExcludedPages, desired.ExcludedPages)) &&
        (desired.IncludedPages === undefined ||
            sameStringList(o.IncludedPages, desired.IncludedPages)) &&
        (desired.FavoritePages === undefined ||
            sameStringList(o.FavoritePages, desired.FavoritePages)) &&
        (desired.SessionSampleRate === undefined ||
            o.SessionSampleRate === desired.SessionSampleRate) &&
        (desired.GuestRoleArn === undefined ||
            o.GuestRoleArn === desired.GuestRoleArn) &&
        (desired.AllowCookies === undefined ||
            (o.AllowCookies ?? false) === desired.AllowCookies) &&
        (desired.Telemetries === undefined ||
            sameStringList(o.Telemetries, desired.Telemetries)) &&
        (desired.EnableXRay === undefined ||
            (o.EnableXRay ?? false) === desired.EnableXRay));
};
const appMonitorArn = (region, accountId, name) => `arn:aws:rum:${region}:${accountId}:appmonitor/${name}`;
export const AppMonitorProvider = () => Provider.effect(AppMonitor, Effect.gen(function* () {
    const createName = Effect.fn(function* (id, props) {
        return (props.appMonitorName ??
            (yield* createPhysicalName({ id, maxLength: 64 })));
    });
    const observeMonitor = (name) => rum.getAppMonitor({ Name: name }).pipe(Effect.map((r) => r.AppMonitor), Effect.catchTag("ResourceNotFoundException", () => Effect.succeed(undefined)));
    return AppMonitor.Provider.of({
        stables: ["appMonitorName", "appMonitorId", "appMonitorArn"],
        list: () => Effect.gen(function* () {
            const { accountId, region } = yield* AWSEnvironment.current;
            const summaries = yield* rum.listAppMonitors
                .items({})
                .pipe(Stream.runCollect);
            return Array.from(summaries).flatMap((monitor) => monitor.Name !== undefined && monitor.Id !== undefined
                ? [
                    {
                        appMonitorName: monitor.Name,
                        appMonitorId: monitor.Id,
                        appMonitorArn: appMonitorArn(region, accountId, monitor.Name),
                    },
                ]
                : []);
        }),
        read: Effect.fn(function* ({ id, olds, output }) {
            const { accountId, region } = yield* AWSEnvironment.current;
            const name = output?.appMonitorName ?? (yield* createName(id, olds ?? {}));
            const found = yield* observeMonitor(name);
            if (found?.Id === undefined)
                return undefined;
            const attrs = {
                appMonitorName: name,
                appMonitorId: found.Id,
                appMonitorArn: appMonitorArn(region, accountId, name),
            };
            const tags = Object.fromEntries(Object.entries(found.Tags ?? {}).filter((t) => t[1] !== undefined));
            return (yield* hasAlchemyTags(id, tags)) ? attrs : Unowned(attrs);
        }),
        diff: Effect.fn(function* ({ id, news, olds }) {
            if (!isResolved(news))
                return undefined;
            yield* validateDomains(news ?? {});
            const oldName = yield* createName(id, olds ?? {});
            const newName = yield* createName(id, news ?? {});
            if (oldName !== newName) {
                return { action: "replace" };
            }
            // fall through: engine default update logic for mutable fields
        }),
        reconcile: Effect.fn(function* ({ id, news, output, session }) {
            yield* validateDomains(news);
            const { accountId, region } = yield* AWSEnvironment.current;
            const name = output?.appMonitorName ?? (yield* createName(id, news));
            const arn = appMonitorArn(region, accountId, name);
            const internalTags = yield* createInternalTags(id);
            const desiredTags = {
                ...news.tags,
                ...internalTags,
            };
            const desiredConfig = desiredConfiguration(news);
            const desiredCwLogEnabled = news.cwLogEnabled ?? false;
            const desiredCustomEvents = news.customEvents ?? "DISABLED";
            // 1. OBSERVE — cloud state is authoritative; output is only a
            //    cache of the derived physical name.
            let live = yield* observeMonitor(name);
            // 2. ENSURE — create when missing; a concurrent create surfaces as
            //    the typed ConflictException, which we treat as a race and
            //    re-observe. CreateAppMonitor is eventually consistent — an
            //    immediate GetAppMonitor can still miss it, and persisting an
            //    undefined appMonitorId poisons every downstream binding env —
            //    so poll (bounded) until the monitor is observable.
            if (live === undefined) {
                yield* rum
                    .createAppMonitor({
                    Name: name,
                    Domain: news.domain,
                    DomainList: news.domainList,
                    Tags: desiredTags,
                    AppMonitorConfiguration: desiredConfig,
                    CwLogEnabled: desiredCwLogEnabled,
                    CustomEvents: { Status: desiredCustomEvents },
                })
                    .pipe(Effect.asVoid, Effect.catchTag("ConflictException", () => Effect.void));
                live = yield* observeMonitor(name).pipe(Effect.repeat({
                    schedule: Schedule.spaced("2 seconds"),
                    until: (monitor) => monitor !== undefined,
                    times: 15,
                }));
            }
            // 3. SYNC — diff the OBSERVED domain(s), configuration, log
            //    setting, and custom-events status against the desired state;
            //    update only on drift.
            const inSync = live !== undefined &&
                (news.domain === undefined || live.Domain === news.domain) &&
                (news.domainList === undefined ||
                    sameStringList(live.DomainList, news.domainList)) &&
                configurationInSync(live.AppMonitorConfiguration, desiredConfig) &&
                (live.DataStorage?.CwLog?.CwLogEnabled ?? false) ===
                    desiredCwLogEnabled &&
                (live.CustomEvents?.Status ?? "DISABLED") === desiredCustomEvents;
            if (!inSync) {
                yield* rum.updateAppMonitor({
                    Name: name,
                    Domain: news.domain,
                    DomainList: news.domainList,
                    AppMonitorConfiguration: desiredConfig,
                    CwLogEnabled: desiredCwLogEnabled,
                    CustomEvents: { Status: desiredCustomEvents },
                });
                live = yield* observeMonitor(name);
            }
            // 3b. SYNC TAGS — diff against OBSERVED cloud tags so adoption
            //     converges (create-time Tags only apply on first create).
            const currentTags = Object.fromEntries(Object.entries(live?.Tags ?? {}).filter((t) => t[1] !== undefined));
            const { upsert, removed } = diffTags(currentTags, desiredTags);
            if (upsert.length > 0) {
                yield* rum.tagResource({
                    ResourceArn: arn,
                    Tags: Object.fromEntries(upsert.map((t) => [t.Key, t.Value])),
                });
            }
            if (removed.length > 0) {
                yield* rum.untagResource({ ResourceArn: arn, TagKeys: removed });
            }
            yield* session.note(name);
            return {
                appMonitorName: name,
                appMonitorId: live?.Id ?? output?.appMonitorId,
                appMonitorArn: arn,
            };
        }),
        delete: Effect.fn(function* ({ output }) {
            yield* rum.deleteAppMonitor({ Name: output.appMonitorName }).pipe(
            // idempotent — the monitor may already be gone
            Effect.catchTag("ResourceNotFoundException", () => Effect.void));
            // When cwLogEnabled is (or was ever) on, RUM vends telemetry into
            // a log group named
            //   /aws/vendedlogs/RUMService_{appMonitorName}{first 8 hex chars of Id}
            // and deleteAppMonitor does NOT remove it — without this reap every
            // deleted log-enabled monitor leaks an orphaned log group. Match
            // the observed groups against the monitor's Id so a sibling
            // monitor whose name extends ours is never reaped by accident.
            const logGroupPrefix = `/aws/vendedlogs/RUMService_${output.appMonitorName}`;
            const idHex = output.appMonitorId.replaceAll("-", "");
            const groups = yield* logs
                .describeLogGroups({ logGroupNamePrefix: logGroupPrefix })
                .pipe(Effect.map((r) => r.logGroups ?? []));
            yield* Effect.forEach(groups.flatMap((g) => g.logGroupName !== undefined &&
                idHex.startsWith(g.logGroupName.slice(logGroupPrefix.length))
                ? [g.logGroupName]
                : []), (logGroupName) => logs
                .deleteLogGroup({ logGroupName })
                .pipe(Effect.catchTag("ResourceNotFoundException", () => Effect.void)));
        }),
    });
}));
//# sourceMappingURL=AppMonitor.js.map