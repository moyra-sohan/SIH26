import * as sesv2 from "@distilled.cloud/aws/sesv2";
import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";
import { Unowned } from "../../AdoptPolicy.js";
import { isResolved } from "../../Diff.js";
import { createPhysicalName } from "../../PhysicalName.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
import { createInternalTags, createTagsList, diffTags, hasAlchemyTags, } from "../../Tags.js";
import { toWireSeconds } from "../../Util/Duration.js";
import { AWSEnvironment } from "../Environment.js";
/**
 * An Amazon SES v2 configuration set — a named group of sending options
 * (TLS policy, reputation metrics, suppression overrides) that you apply to
 * outbound email, either per-message or as an identity's default.
 *
 * Attach event destinations with `SES.ConfigurationSetEventDestination` to
 * stream send/delivery/bounce/complaint events to SNS, EventBridge, or
 * CloudWatch.
 * ### Creating Configuration Sets
 * **Example:** Basic Configuration Set
 * ```typescript
 * import * as SES from "alchemy/AWS/SES";
 *
 * const configSet = yield* SES.ConfigurationSet("Default", {});
 * ```
 *
 * **Example:** Require TLS and Publish Reputation Metrics
 * ```typescript
 * const configSet = yield* SES.ConfigurationSet("Strict", {
 *   tlsPolicy: "REQUIRE",
 *   reputationMetricsEnabled: true,
 * });
 * ```
 *
 * **Example:** Suppress Bounces and Complaints
 * ```typescript
 * const configSet = yield* SES.ConfigurationSet("Suppressing", {
 *   suppressedReasons: ["BOUNCE", "COMPLAINT"],
 * });
 * ```
 *
 * ### Open and Click Tracking
 * **Example:** Host Tracking Links on Your Own Domain
 * ```typescript
 * // The redirect domain must be a verified subdomain you own with a valid
 * // certificate. Omit `tracking` entirely to keep SES's current setting.
 * const configSet = yield* SES.ConfigurationSet("Tracked", {
 *   tracking: {
 *     customRedirectDomain: "links.example.com",
 *     httpsPolicy: "REQUIRE",
 *   },
 * });
 * ```
 *
 * ### Virtual Deliverability Manager
 * **Example:** Collect Engagement Metrics for This Configuration Set
 * ```typescript
 * // Requires account-level VDM — see SES.AccountSettings.
 * const configSet = yield* SES.ConfigurationSet("Measured", {
 *   vdm: {
 *     dashboardEngagementMetrics: "ENABLED",
 *     guardianOptimizedSharedDelivery: "ENABLED",
 *   },
 * });
 * ```
 *
 * ### Event Destinations
 * **Example:** Stream Events to SNS
 * ```typescript
 * const topic = yield* SNS.Topic("EmailEvents", {});
 * const destination = yield* SES.ConfigurationSetEventDestination("ToSns", {
 *   configurationSetName: configSet.configurationSetName,
 *   matchingEventTypes: ["SEND", "DELIVERY", "BOUNCE", "COMPLAINT"],
 *   snsDestination: { topicArn: topic.topicArn },
 * });
 * ```
 *
 * @resource
 */
export const ConfigurationSet = Resource("AWS.SES.ConfigurationSet");
const toTagRecord = (tags) => Object.fromEntries((tags ?? []).map((tag) => [tag.Key, tag.Value]));
const configurationSetArnOf = (region, accountId, name) => `arn:aws:ses:${region}:${accountId}:configuration-set/${name}`;
const sameReasons = (a, b) => {
    const left = [...(a ?? [])].sort();
    const right = [...b].sort();
    return left.length === right.length && left.every((v, i) => v === right[i]);
};
export const ConfigurationSetProvider = () => Provider.effect(ConfigurationSet, Effect.gen(function* () {
    const createName = Effect.fn(function* (id, props) {
        return (props.configurationSetName ??
            (yield* createPhysicalName({ id, maxLength: 64 })));
    });
    const getConfigurationSet = Effect.fn(function* (name) {
        return yield* sesv2
            .getConfigurationSet({ ConfigurationSetName: name })
            .pipe(Effect.catchTag("NotFoundException", () => Effect.succeed(undefined)));
    });
    return ConfigurationSet.Provider.of({
        stables: ["configurationSetName", "configurationSetArn"],
        list: () => Effect.gen(function* () {
            const { accountId, region } = yield* AWSEnvironment.current;
            const pages = yield* sesv2.listConfigurationSets
                .pages({})
                .pipe(Stream.runCollect);
            return Array.from(pages)
                .flatMap((page) => page.ConfigurationSets ?? [])
                .map((name) => ({
                configurationSetName: name,
                configurationSetArn: configurationSetArnOf(region, accountId, name),
            }));
        }),
        read: Effect.fn(function* ({ id, olds, output }) {
            const { accountId, region } = yield* AWSEnvironment.current;
            const name = output?.configurationSetName ?? (yield* createName(id, olds ?? {}));
            const found = yield* getConfigurationSet(name);
            if (!found)
                return undefined;
            const attrs = {
                configurationSetName: name,
                configurationSetArn: configurationSetArnOf(region, accountId, name),
            };
            const tags = toTagRecord(found.Tags);
            return (yield* hasAlchemyTags(id, tags)) ? attrs : Unowned(attrs);
        }),
        diff: Effect.fn(function* ({ id, news, olds }) {
            if (!isResolved(news))
                return undefined;
            const oldName = yield* createName(id, olds ?? {});
            const newName = yield* createName(id, news ?? {});
            if (oldName !== newName) {
                return { action: "replace" };
            }
        }),
        reconcile: Effect.fn(function* ({ id, news, output, session }) {
            const { accountId, region } = yield* AWSEnvironment.current;
            const name = output?.configurationSetName ?? (yield* createName(id, news));
            const configurationSetArn = configurationSetArnOf(region, accountId, name);
            const internalTags = yield* createInternalTags(id);
            const desiredTags = { ...news.tags, ...internalTags };
            const desiredMaxDelivery = toWireSeconds(news.maxDelivery);
            // 1. OBSERVE — cloud state is authoritative.
            let observed = yield* getConfigurationSet(name);
            // 2. ENSURE — create with the full desired option set in one call;
            //    AlreadyExists is a race, not a failure.
            if (observed === undefined) {
                yield* sesv2
                    .createConfigurationSet({
                    ConfigurationSetName: name,
                    SendingOptions: news.sendingEnabled !== undefined
                        ? { SendingEnabled: news.sendingEnabled }
                        : undefined,
                    ReputationOptions: news.reputationMetricsEnabled !== undefined
                        ? {
                            ReputationMetricsEnabled: news.reputationMetricsEnabled,
                        }
                        : undefined,
                    DeliveryOptions: news.tlsPolicy !== undefined ||
                        desiredMaxDelivery !== undefined
                        ? {
                            TlsPolicy: news.tlsPolicy,
                            MaxDeliverySeconds: desiredMaxDelivery,
                        }
                        : undefined,
                    SuppressionOptions: news.suppressedReasons !== undefined
                        ? { SuppressedReasons: news.suppressedReasons }
                        : undefined,
                    Tags: createTagsList(desiredTags),
                })
                    .pipe(Effect.catchTag("AlreadyExistsException", () => Effect.succeed({})));
                observed = yield* sesv2.getConfigurationSet({
                    ConfigurationSetName: name,
                });
            }
            // 3. SYNC — per mutable aspect: diff observed against desired and
            //    apply only the delta.
            const desiredSending = news.sendingEnabled ?? true;
            if ((observed.SendingOptions?.SendingEnabled ?? true) !== desiredSending) {
                yield* sesv2.putConfigurationSetSendingOptions({
                    ConfigurationSetName: name,
                    SendingEnabled: desiredSending,
                });
            }
            const desiredReputation = news.reputationMetricsEnabled ?? false;
            if ((observed.ReputationOptions?.ReputationMetricsEnabled ?? false) !==
                desiredReputation) {
                yield* sesv2.putConfigurationSetReputationOptions({
                    ConfigurationSetName: name,
                    ReputationMetricsEnabled: desiredReputation,
                });
            }
            const desiredTls = news.tlsPolicy ?? "OPTIONAL";
            const observedTls = observed.DeliveryOptions?.TlsPolicy ?? "OPTIONAL";
            const observedMaxDelivery = observed.DeliveryOptions?.MaxDeliverySeconds;
            if (observedTls !== desiredTls ||
                (desiredMaxDelivery !== undefined &&
                    observedMaxDelivery !== desiredMaxDelivery)) {
                yield* sesv2.putConfigurationSetDeliveryOptions({
                    ConfigurationSetName: name,
                    TlsPolicy: desiredTls,
                    MaxDeliverySeconds: desiredMaxDelivery ?? observedMaxDelivery,
                    // preserve any dedicated sending pool configured out-of-band
                    SendingPoolName: observed.DeliveryOptions?.SendingPoolName,
                });
            }
            // Suppression is only synced when explicitly configured so an
            // unset prop keeps inheriting the account-level defaults.
            if (news.suppressedReasons !== undefined &&
                !sameReasons(observed.SuppressionOptions?.SuppressedReasons, news.suppressedReasons)) {
                yield* sesv2.putConfigurationSetSuppressionOptions({
                    ConfigurationSetName: name,
                    SuppressedReasons: news.suppressedReasons,
                });
            }
            // Tracking is only synced when the caller manages it; leaving the
            // prop undefined keeps whatever SES currently has. `httpsPolicy`
            // cannot drift on its own — the type requires a custom domain
            // alongside it, because SES has no way to set an HTTPS policy for
            // the default tracking domain.
            if (news.tracking !== undefined &&
                (observed.TrackingOptions?.CustomRedirectDomain !==
                    news.tracking.customRedirectDomain ||
                    (news.tracking.httpsPolicy !== undefined &&
                        observed.TrackingOptions?.HttpsPolicy !==
                            news.tracking.httpsPolicy))) {
                yield* sesv2.putConfigurationSetTrackingOptions({
                    ConfigurationSetName: name,
                    CustomRedirectDomain: news.tracking.customRedirectDomain,
                    HttpsPolicy: news.tracking.httpsPolicy,
                });
            }
            // VDM is only synced when explicitly configured; it requires
            // account-level VDM to be enabled.
            //
            // putConfigurationSetVdmOptions REPLACES VdmOptions wholesale: an
            // omitted DashboardOptions/GuardianOptions is dropped, not left
            // alone (verified against the live API). So a caller who manages
            // only one of the two would silently wipe the other on every
            // deploy. Backfill the unmanaged member from observed state.
            const desiredDashboard = news.vdm?.dashboardEngagementMetrics ??
                observed.VdmOptions?.DashboardOptions?.EngagementMetrics;
            const desiredGuardian = news.vdm?.guardianOptimizedSharedDelivery ??
                observed.VdmOptions?.GuardianOptions?.OptimizedSharedDelivery;
            if (news.vdm !== undefined &&
                (observed.VdmOptions?.DashboardOptions?.EngagementMetrics !==
                    desiredDashboard ||
                    observed.VdmOptions?.GuardianOptions?.OptimizedSharedDelivery !==
                        desiredGuardian)) {
                yield* sesv2.putConfigurationSetVdmOptions({
                    ConfigurationSetName: name,
                    VdmOptions: {
                        DashboardOptions: desiredDashboard !== undefined
                            ? { EngagementMetrics: desiredDashboard }
                            : undefined,
                        GuardianOptions: desiredGuardian !== undefined
                            ? { OptimizedSharedDelivery: desiredGuardian }
                            : undefined,
                    },
                });
            }
            // 3b. SYNC TAGS — diff against OBSERVED cloud tags.
            const observedTags = toTagRecord(observed.Tags);
            const { upsert, removed } = diffTags(observedTags, desiredTags);
            if (upsert.length > 0) {
                yield* sesv2.tagResource({
                    ResourceArn: configurationSetArn,
                    Tags: upsert,
                });
            }
            if (removed.length > 0) {
                yield* sesv2.untagResource({
                    ResourceArn: configurationSetArn,
                    TagKeys: removed,
                });
            }
            yield* session.note(configurationSetArn);
            return { configurationSetName: name, configurationSetArn };
        }),
        delete: Effect.fn(function* ({ output }) {
            yield* sesv2
                .deleteConfigurationSet({
                ConfigurationSetName: output.configurationSetName,
            })
                .pipe(Effect.catchTag("NotFoundException", () => Effect.void));
        }),
    });
}));
//# sourceMappingURL=ConfigurationSet.js.map