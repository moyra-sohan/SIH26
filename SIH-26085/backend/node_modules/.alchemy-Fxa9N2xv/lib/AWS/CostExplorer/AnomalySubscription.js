import * as ce from "@distilled.cloud/aws/cost-explorer";
import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";
import { Unowned } from "../../AdoptPolicy.js";
import { createPhysicalName } from "../../PhysicalName.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
import { createInternalTags, hasAlchemyTags } from "../../Tags.js";
import { fetchCeTags, pinCe, syncCeTags, toResourceTags } from "./common.js";
/**
 * A Cost Explorer anomaly alert subscription. Attaches email or SNS
 * subscribers to one or more {@link AnomalyMonitor}s with a notification
 * frequency and an impact threshold.
 *
 * Cost Explorer is a global service — all calls are pinned to `us-east-1`
 * regardless of the stack region. Every property is mutable in place.
 *
 * ### Creating Anomaly Subscriptions
 * **Example:** Daily email digest for anomalies over $100
 * ```typescript
 * import * as CostExplorer from "alchemy/AWS/CostExplorer";
 *
 * const monitor = yield* CostExplorer.AnomalyMonitor("ServiceSpend", {
 *   monitorType: "DIMENSIONAL",
 *   monitorDimension: "SERVICE",
 * });
 *
 * const subscription = yield* CostExplorer.AnomalySubscription("Alerts", {
 *   monitorArnList: [monitor.monitorArn],
 *   frequency: "DAILY",
 *   subscribers: [{ type: "EMAIL", address: "team@example.com" }],
 *   thresholdExpression: {
 *     Dimensions: {
 *       Key: "ANOMALY_TOTAL_IMPACT_ABSOLUTE",
 *       MatchOptions: ["GREATER_THAN_OR_EQUAL"],
 *       Values: ["100"],
 *     },
 *   },
 * });
 * ```
 *
 * **Example:** Immediate SNS notifications
 * ```typescript
 * const subscription = yield* CostExplorer.AnomalySubscription("PagerFeed", {
 *   monitorArnList: [monitor.monitorArn],
 *   frequency: "IMMEDIATE",
 *   subscribers: [{ type: "SNS", address: topic.topicArn }],
 * });
 * ```
 *
 * @resource
 */
export const AnomalySubscription = Resource("AWS.CostExplorer.AnomalySubscription");
const sameStringSets = (l, r) => l.length === r.length &&
    [...l].sort().join("\n") === [...r].sort().join("\n");
export const AnomalySubscriptionProvider = () => Provider.effect(AnomalySubscription, Effect.gen(function* () {
    const createName = Effect.fn(function* (id, props) {
        return (props.subscriptionName ??
            (yield* createPhysicalName({ id, maxLength: 100 })));
    });
    const getByArn = (subscriptionArn) => pinCe(ce.getAnomalySubscriptions({
        SubscriptionArnList: [subscriptionArn],
    })).pipe(Effect.map((r) => r.AnomalySubscriptions[0]), Effect.catchTag("UnknownSubscriptionException", () => Effect.succeed(undefined)));
    const findByName = (subscriptionName) => pinCe(ce.getAnomalySubscriptions.items({}).pipe(Stream.filter((s) => s.SubscriptionName === subscriptionName), Stream.take(1), Stream.runCollect)).pipe(Effect.map((chunk) => Array.from(chunk)[0]));
    const toAttrs = Effect.fn(function* (live) {
        const subscriptionArn = live.SubscriptionArn;
        return {
            subscriptionArn,
            subscriptionName: live.SubscriptionName,
            accountId: live.AccountId,
            tags: yield* fetchCeTags(subscriptionArn),
        };
    });
    const toSubscribers = (subscribers) => subscribers.map((s) => ({ Address: s.address, Type: s.type }));
    return AnomalySubscription.Provider.of({
        stables: ["subscriptionArn", "accountId"],
        list: () => Effect.gen(function* () {
            const subscriptions = yield* pinCe(ce.getAnomalySubscriptions.items({}).pipe(Stream.runCollect)).pipe(Effect.map((chunk) => Array.from(chunk)));
            return yield* Effect.forEach(subscriptions.filter((s) => s.SubscriptionArn !== undefined), toAttrs, { concurrency: 10 });
        }),
        read: Effect.fn(function* ({ id, olds, output }) {
            const live = output?.subscriptionArn
                ? yield* getByArn(output.subscriptionArn)
                : yield* findByName(yield* createName(id, olds ?? {}));
            if (live?.SubscriptionArn === undefined)
                return undefined;
            const attrs = yield* toAttrs(live);
            return (yield* hasAlchemyTags(id, attrs.tags))
                ? attrs
                : Unowned(attrs);
        }),
        reconcile: Effect.fn(function* ({ id, news, output, session }) {
            const name = yield* createName(id, news);
            const internalTags = yield* createInternalTags(id);
            const desiredTags = {
                ...news.tags,
                ...internalTags,
            };
            const desiredSubscribers = toSubscribers(news.subscribers);
            // OBSERVE — cloud state is authoritative.
            const live = output?.subscriptionArn
                ? yield* getByArn(output.subscriptionArn)
                : yield* findByName(name);
            let subscriptionArn;
            if (live?.SubscriptionArn === undefined) {
                // ENSURE — create if missing. Subscription names are unique per
                // account; tolerate the AlreadyExists race by adopting the
                // same-name subscription and converging it (every property is
                // mutable via UpdateAnomalySubscription).
                const created = yield* pinCe(ce.createAnomalySubscription({
                    AnomalySubscription: {
                        SubscriptionName: name,
                        MonitorArnList: news.monitorArnList,
                        Subscribers: desiredSubscribers,
                        Frequency: news.frequency,
                        ThresholdExpression: news.thresholdExpression,
                    },
                    ResourceTags: toResourceTags(desiredTags),
                })).pipe(Effect.catchTag("AnomalySubscriptionAlreadyExists", (error) => Effect.gen(function* () {
                    const existing = yield* findByName(name);
                    const existingArn = existing?.SubscriptionArn;
                    if (existingArn === undefined) {
                        return yield* Effect.fail(error);
                    }
                    return yield* pinCe(ce.updateAnomalySubscription({
                        SubscriptionArn: existingArn,
                        SubscriptionName: name,
                        MonitorArnList: news.monitorArnList,
                        Subscribers: desiredSubscribers,
                        Frequency: news.frequency,
                        ThresholdExpression: news.thresholdExpression,
                    }));
                })));
                subscriptionArn = created.SubscriptionArn;
            }
            else {
                // SYNC — diff observed against desired; every field is mutable.
                subscriptionArn = live.SubscriptionArn;
                const observed = live;
                const needsUpdate = observed.SubscriptionName !== name ||
                    observed.Frequency !== news.frequency ||
                    !sameStringSets(observed.MonitorArnList, news.monitorArnList) ||
                    !sameStringSets(observed.Subscribers.map((s) => `${s.Type}:${s.Address}`), desiredSubscribers.map((s) => `${s.Type}:${s.Address}`)) ||
                    (news.thresholdExpression !== undefined &&
                        JSON.stringify(observed.ThresholdExpression) !==
                            JSON.stringify(news.thresholdExpression));
                if (needsUpdate) {
                    yield* pinCe(ce.updateAnomalySubscription({
                        SubscriptionArn: subscriptionArn,
                        SubscriptionName: name,
                        MonitorArnList: news.monitorArnList,
                        Subscribers: desiredSubscribers,
                        Frequency: news.frequency,
                        ThresholdExpression: news.thresholdExpression,
                    }));
                }
            }
            // SYNC TAGS — diff against observed cloud tags.
            yield* syncCeTags(subscriptionArn, desiredTags);
            yield* session.note(subscriptionArn);
            const final = yield* getByArn(subscriptionArn);
            return {
                subscriptionArn,
                subscriptionName: name,
                accountId: final?.AccountId,
                tags: desiredTags,
            };
        }),
        delete: Effect.fn(function* ({ output }) {
            yield* pinCe(ce.deleteAnomalySubscription({
                SubscriptionArn: output.subscriptionArn,
            })).pipe(Effect.catchTag("UnknownSubscriptionException", () => Effect.void));
        }),
    });
}));
//# sourceMappingURL=AnomalySubscription.js.map