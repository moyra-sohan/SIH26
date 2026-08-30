import * as r2 from "@distilled.cloud/cloudflare/r2";
import * as Effect from "effect/Effect";
import * as Predicate from "effect/Predicate";
import * as Schedule from "effect/Schedule";
import { Unowned } from "../../AdoptPolicy.js";
import { deepEqual } from "../../Diff.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
import { CloudflareEnvironment } from "../CloudflareEnvironment.js";
const TypeId = "Cloudflare.R2.BucketEventNotification";
/**
 * Event notifications for a Cloudflare R2 bucket, delivered to a Queue.
 *
 * When objects in the bucket are created, deleted, or copied, R2 publishes
 * an event message to the configured Queue. One configuration exists per
 * (bucket, queue) pair and holds a list of rules; consume the messages with
 * a Queue consumer Worker.
 *
 * The configuration's identity is the (bucket, queue) pair — changing
 * either triggers a replacement, while rule changes are applied in place
 * (the provider converges the pair's configuration to exactly the
 * declared rule set).
 * ### Notifying a Queue
 * **Example:** Notify on every upload and delete
 * ```typescript
 * const bucket = yield* Cloudflare.R2.Bucket("Uploads");
 * const queue = yield* Cloudflare.Queues.Queue("UploadEvents");
 *
 * yield* Cloudflare.R2.BucketEventNotification("UploadNotifications", {
 *   bucketName: bucket.bucketName,
 *   queueId: queue.queueId,
 *   rules: [
 *     {
 *       actions: ["PutObject", "CompleteMultipartUpload", "DeleteObject"],
 *     },
 *   ],
 * });
 * ```
 *
 * **Example:** Scope notifications to a key prefix and suffix
 * ```typescript
 * yield* Cloudflare.R2.BucketEventNotification("ImageNotifications", {
 *   bucketName: bucket.bucketName,
 *   queueId: queue.queueId,
 *   rules: [
 *     {
 *       actions: ["PutObject"],
 *       prefix: "images/",
 *       suffix: ".png",
 *       description: "new PNG images",
 *     },
 *   ],
 * });
 * ```
 *
 * ### Multiple rules
 * **Example:** Separate rules per key range
 * ```typescript
 * // Rules must cover non-overlapping key ranges — Cloudflare rejects
 * // overlapping prefixes/suffixes even when the actions are disjoint.
 * yield* Cloudflare.R2.BucketEventNotification("Notifications", {
 *   bucketName: bucket.bucketName,
 *   queueId: queue.queueId,
 *   rules: [
 *     { actions: ["PutObject"], prefix: "incoming/" },
 *     { actions: ["DeleteObject", "LifecycleDeletion"], prefix: "logs/" },
 *   ],
 * });
 * ```
 *
 * @see https://developers.cloudflare.com/r2/buckets/event-notifications/
 *
 * @resource
 * @product R2
 * @category Storage & Databases
 */
export const BucketEventNotification = Resource(TypeId);
/**
 * Returns true if the given value is an BucketEventNotification resource.
 */
export const isBucketEventNotification = (value) => Predicate.hasProperty(value, "Type") && value.Type === TypeId;
export const BucketEventNotificationProvider = () => Provider.succeed(BucketEventNotification, {
    stables: ["bucketName", "queueId", "accountId", "jurisdiction"],
    diff: Effect.fn(function* ({ olds = {}, news }) {
        const o = olds;
        const n = news;
        // No prior props to compare against — let the engine decide.
        if (o.bucketName === undefined)
            return undefined;
        // bucketName/queueId are Input<string>; compare only once both
        // sides are concrete strings.
        if (typeof o.bucketName === "string" &&
            typeof n.bucketName === "string" &&
            o.bucketName !== n.bucketName) {
            return { action: "replace" };
        }
        if (typeof o.queueId === "string" &&
            typeof n.queueId === "string" &&
            o.queueId !== n.queueId) {
            return { action: "replace" };
        }
        if ((o.jurisdiction ?? "default") !== (n.jurisdiction ?? "default")) {
            return { action: "replace" };
        }
        return undefined;
    }),
    read: Effect.fn(function* ({ output, olds }) {
        const { accountId } = yield* yield* CloudflareEnvironment;
        const acct = output?.accountId ?? accountId;
        // The (bucket, queue) pair is the configuration's identity; cold
        // reads derive it from the last-persisted props.
        const bucketName = output?.bucketName ??
            (typeof olds?.bucketName === "string" ? olds.bucketName : undefined);
        const queueId = output?.queueId ??
            (typeof olds?.queueId === "string" ? olds.queueId : undefined);
        if (bucketName === undefined || queueId === undefined)
            return undefined;
        const jurisdiction = output?.jurisdiction ?? olds?.jurisdiction ?? "default";
        const observed = yield* getConfiguration(acct, bucketName, queueId, jurisdiction);
        if (!observed)
            return undefined;
        const attrs = toAttributes(observed, acct, bucketName, queueId, jurisdiction);
        // Event notification configs carry no ownership markers. With no
        // prior output we cannot prove we created this configuration —
        // brand it `Unowned` so takeover is gated behind the adopt policy.
        return output ? attrs : Unowned(attrs);
    }),
    reconcile: Effect.fn(function* ({ news, output }) {
        const { accountId } = yield* yield* CloudflareEnvironment;
        const acct = output?.accountId ?? accountId;
        // Inputs have been resolved to concrete strings by Plan.
        const bucketName = news.bucketName;
        const queueId = news.queueId;
        const jurisdiction = news.jurisdiction ?? "default";
        // 1. Observe — the configuration may or may not exist; `output` is
        //    only a cache of the identity, never proof of existence.
        const observed = yield* getConfiguration(acct, bucketName, queueId, jurisdiction);
        // 2/3. Ensure + sync — skip the API entirely when the observed rules
        //    already match the desired set.
        if (!observed || !sameRules(observed.rules ?? [], news.rules)) {
            // The PUT *appends* rules to the queue's configuration (it is not
            // a full replace — verified against the live API), so on drift
            // the existing configuration must be cleared first. The brief gap
            // is unavoidable; each step is independently idempotent.
            if (observed) {
                yield* r2
                    .deleteBucketEventNotification({
                    accountId: acct,
                    bucketName,
                    queueId,
                    jurisdiction,
                })
                    .pipe(Effect.catchTag([
                    "EventNotificationConfigNotFound",
                    "BucketNotFound",
                    "QueueNotFound",
                ], () => Effect.void));
            }
            yield* r2
                .putBucketEventNotification({
                accountId: acct,
                bucketName,
                queueId,
                jurisdiction,
                rules: news.rules.map((rule) => ({
                    actions: [...rule.actions],
                    prefix: rule.prefix,
                    suffix: rule.suffix,
                    description: rule.description,
                })),
            })
                .pipe(
            // A freshly-created bucket or queue can briefly 404 on the
            // event-notification endpoint — ride out the consistency lag.
            Effect.retry({
                while: (e) => e._tag === "BucketNotFound" || e._tag === "QueueNotFound",
                schedule: r2EventNotificationConsistencySchedule,
            }));
        }
        // 4. Return — re-read so the attributes carry the server-assigned
        //    per-rule IDs. The read can lag the PUT briefly.
        if (news.rules.length === 0) {
            // An empty rule set reads back as "no configuration".
            return toAttributes({ queueId, queueName: undefined, rules: [] }, acct, bucketName, queueId, jurisdiction);
        }
        const final = yield* r2
            .getBucketEventNotification({
            accountId: acct,
            bucketName,
            queueId,
            jurisdiction,
        })
            .pipe(Effect.retry({
            while: (e) => e._tag === "NoEventNotificationConfig" ||
                e._tag === "EventNotificationConfigNotFound" ||
                e._tag === "BucketNotFound" ||
                e._tag === "QueueNotFound",
            schedule: r2EventNotificationConsistencySchedule,
        }));
        return toAttributes(final, acct, bucketName, queueId, jurisdiction);
    }),
    delete: Effect.fn(function* ({ output }) {
        // Idempotent — the configuration, bucket, or queue may already be
        // gone (all typed not-found variants in the operation's union).
        yield* r2
            .deleteBucketEventNotification({
            accountId: output.accountId,
            bucketName: output.bucketName,
            queueId: output.queueId,
            jurisdiction: output.jurisdiction,
        })
            .pipe(Effect.catchTag([
            "EventNotificationConfigNotFound",
            "BucketNotFound",
            "QueueNotFound",
        ], () => Effect.void));
    }),
    // Parent fan-out: a notification configuration is keyed by (bucket,
    // queue) and there is no account-wide enumeration. Enumerate every R2
    // bucket (account-scoped), then list each bucket's event-notification
    // queues — one (bucket, queue) pair is one BucketEventNotification.
    list: Effect.fn(function* () {
        const { accountId } = yield* yield* CloudflareEnvironment;
        const buckets = yield* listAllBuckets(accountId);
        const perBucket = yield* Effect.forEach(buckets, (bucket) => {
            const bucketName = bucket.name;
            if (bucketName == null) {
                return Effect.succeed([]);
            }
            const jurisdiction = (bucket.jurisdiction ??
                "default");
            return r2
                .listBucketEventNotifications({
                accountId,
                bucketName,
                jurisdiction,
            })
                .pipe(Effect.map((res) => (res.queues ?? [])
                .filter((q) => q.queueId != null)
                .map((q) => ({
                bucketName,
                // The endpoint echoes the queue ID in dashed-UUID
                // form; normalise to the undashed form
                // `Queue.queueId` uses so list items match `read`.
                queueId: q.queueId.replace(/-/g, ""),
                queueName: q.queueName ?? undefined,
                accountId,
                jurisdiction,
                rules: (q.rules ?? []).map(toRuleAttributes),
            }))), 
            // A bucket with no event-notification config (or a bucket
            // that vanished mid-enumeration) is not an error — skip it.
            Effect.catchTag([
                "NoEventNotificationConfig",
                "BucketNotFound",
                "NoSuchBucket",
                // Plan-gated / partial buckets reject the route.
                "InvalidRoute",
            ], () => Effect.succeed([])));
        }, { concurrency: 10 });
        return perBucket.flat();
    }),
});
// R2 can make a freshly-created bucket/queue visible to its own endpoints
// before the event-notification endpoints accept it. Retry only that narrow
// not-found lag with a bounded budget.
const r2EventNotificationConsistencySchedule = Schedule.max([
    Schedule.exponential(250),
    Schedule.recurs(6),
]);
// `listBuckets` is a non-paginated distilled op that returns at most one
// page (default ordering by name). Page through it exhaustively with the
// `startAfter` cursor so `list()` enumerates *every* bucket in the account.
const listAllBuckets = (accountId) => Effect.gen(function* () {
    const pageSize = 1000;
    const all = [];
    let startAfter;
    while (true) {
        const { buckets } = yield* r2.listBuckets({
            accountId,
            perPage: pageSize,
            startAfter,
        });
        const page = buckets ?? [];
        all.push(...page);
        const last = page.at(-1)?.name;
        if (page.length < pageSize || last == null)
            break;
        startAfter = last;
    }
    return all;
});
const getConfiguration = (accountId, bucketName, queueId, jurisdiction) => r2
    .getBucketEventNotification({
    accountId,
    bucketName,
    queueId,
    jurisdiction,
})
    .pipe(Effect.map((config) => config), 
// "Gone" comes in several typed flavors: the bucket has no event
// notification config at all (`NoEventNotificationConfig`, code
// 11015), no config for this queue (`EventNotificationConfigNotFound`,
// code 11011), or the bucket/queue themselves are gone.
Effect.catchTag([
    "NoEventNotificationConfig",
    "EventNotificationConfigNotFound",
    "BucketNotFound",
    "QueueNotFound",
], () => Effect.succeed(undefined)));
const toRuleAttributes = (rule) => ({
    // Distilled widens generated string enums to open unions; the API only
    // returns the known action variants.
    actions: [...rule.actions],
    prefix: rule.prefix ?? "",
    suffix: rule.suffix ?? "",
    description: rule.description ?? undefined,
    ruleId: rule.ruleId ?? undefined,
    createdAt: rule.createdAt ?? undefined,
});
const toAttributes = (config, accountId, bucketName, queueId, jurisdiction) => ({
    bucketName,
    // The endpoint echoes the queue ID in dashed-UUID form while the Queues
    // API uses the undashed form — keep the canonical input ID so attributes
    // compare cleanly against `Queue.queueId`.
    queueId,
    queueName: config.queueName ?? undefined,
    accountId,
    jurisdiction,
    rules: (config.rules ?? []).map(toRuleAttributes),
});
/**
 * A rule's identity within the configuration: its matched actions (order-
 * insensitive) plus prefix/suffix. The server-assigned `ruleId` and
 * auto-generated description are deliberately excluded.
 */
const ruleIdentity = (rule) => JSON.stringify({
    actions: [...rule.actions].sort(),
    prefix: rule.prefix ?? "",
    suffix: rule.suffix ?? "",
});
/**
 * Compares the observed rules against the desired rules as an unordered
 * set. Descriptions are compared only when the desired rule specifies one —
 * Cloudflare auto-generates a description otherwise.
 */
const sameRules = (observed, desired) => {
    if (observed.length !== desired.length)
        return false;
    const observedKeys = observed.map(ruleIdentity).sort();
    const desiredKeys = desired.map(ruleIdentity).sort();
    if (!deepEqual(observedKeys, desiredKeys))
        return false;
    return desired.every((rule) => rule.description === undefined ||
        observed.some((candidate) => ruleIdentity(candidate) === ruleIdentity(rule) &&
            (candidate.description ?? "") === rule.description));
};
//# sourceMappingURL=BucketEventNotification.js.map