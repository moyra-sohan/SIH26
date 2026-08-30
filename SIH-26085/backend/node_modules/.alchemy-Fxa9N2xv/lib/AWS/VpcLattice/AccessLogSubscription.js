import * as vpclattice from "@distilled.cloud/aws/vpc-lattice";
import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";
import { Unowned } from "../../AdoptPolicy.js";
import { isResolved } from "../../Diff.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
import { createInternalTags, diffTags, hasAlchemyTags, tagRecord, } from "../../Tags.js";
import { retryOnConflict } from "./internal.js";
/** The delivery service encoded in a destination ARN (`arn:aws:<service>:…`). */
const destinationType = (arn) => arn.split(":")[2] ?? "";
/**
 * Normalize a destination ARN for comparison — CloudWatch log-group ARNs
 * round-trip through the API with a trailing `:*`.
 */
const normalizeDestinationArn = (arn) => arn.replace(/:\*$/, "");
/**
 * An Amazon VPC Lattice access log subscription — delivers per-request
 * access logs for a service network or lattice service to CloudWatch Logs,
 * Kinesis Data Firehose, or S3.
 *
 * ### Creating Access Log Subscriptions
 * **Example:** Log a Service Network to CloudWatch
 * ```typescript
 * const logs = yield* AccessLogSubscription("NetworkLogs", {
 *   resourceIdentifier: network.serviceNetworkId,
 *   destinationArn: logGroup.logGroupArn,
 * });
 * ```
 *
 * **Example:** Log a Service to S3
 * ```typescript
 * const logs = yield* AccessLogSubscription("ServiceLogs", {
 *   resourceIdentifier: service.serviceId,
 *   destinationArn: bucket.bucketArn,
 * });
 * ```
 *
 * @resource
 */
export const AccessLogSubscription = Resource("AWS.VpcLattice.AccessLogSubscription");
export const AccessLogSubscriptionProvider = () => Provider.effect(AccessLogSubscription, Effect.gen(function* () {
    const observe = (id) => vpclattice
        .getAccessLogSubscription({ accessLogSubscriptionIdentifier: id })
        .pipe(Effect.catchTag("ResourceNotFoundException", () => Effect.succeed(undefined)));
    // A resource can hold at most one subscription per destination type;
    // recover the existing one for our destination's type.
    const findByDestinationType = (resourceIdentifier, desiredDestinationArn) => vpclattice.listAccessLogSubscriptions
        .pages({ resourceIdentifier })
        .pipe(Stream.runCollect, Effect.map((chunk) => Array.from(chunk)
        .flatMap((page) => page.items ?? [])
        .find((s) => destinationType(s.destinationArn) ===
        destinationType(desiredDestinationArn))), Effect.catchTag("ResourceNotFoundException", () => Effect.succeed(undefined)));
    const syncTags = Effect.fn(function* (arn, desiredTags) {
        const listed = yield* vpclattice.listTagsForResource({
            resourceArn: arn,
        });
        const { removed, upsert } = diffTags(tagRecord(listed.tags), desiredTags);
        if (upsert.length > 0) {
            yield* vpclattice.tagResource({
                resourceArn: arn,
                tags: Object.fromEntries(upsert.map((t) => [t.Key, t.Value])),
            });
        }
        if (removed.length > 0) {
            yield* vpclattice.untagResource({
                resourceArn: arn,
                tagKeys: removed,
            });
        }
    });
    return {
        stables: [
            "accessLogSubscriptionId",
            "accessLogSubscriptionArn",
            "resourceId",
            "resourceArn",
        ],
        diff: Effect.fn(function* ({ olds, news }) {
            if (!isResolved(news))
                return;
            if (olds?.resourceIdentifier !== news.resourceIdentifier ||
                (olds?.serviceNetworkLogType ?? undefined) !==
                    news.serviceNetworkLogType) {
                return { action: "replace" };
            }
            // The destination is mutable in place, but only within the same
            // destination service (CloudWatch/Firehose/S3).
            if (olds !== undefined &&
                destinationType(olds.destinationArn) !==
                    destinationType(news.destinationArn)) {
                return { action: "replace" };
            }
        }),
        read: Effect.fn(function* ({ id, olds, output }) {
            const subscription = output?.accessLogSubscriptionId
                ? yield* observe(output.accessLogSubscriptionId)
                : olds
                    ? yield* findByDestinationType(olds.resourceIdentifier, olds.destinationArn)
                    : undefined;
            if (!subscription)
                return undefined;
            const listed = yield* vpclattice.listTagsForResource({
                resourceArn: subscription.arn,
            });
            const attrs = {
                accessLogSubscriptionId: subscription.id,
                accessLogSubscriptionArn: subscription.arn,
                resourceId: subscription.resourceId,
                resourceArn: subscription.resourceArn,
                destinationArn: subscription.destinationArn,
                tags: tagRecord(listed.tags),
            };
            return (yield* hasAlchemyTags(id, listed.tags))
                ? attrs
                : Unowned(attrs);
        }),
        reconcile: Effect.fn(function* ({ id, news, output, session }) {
            const internalTags = yield* createInternalTags(id);
            const desiredTags = { ...internalTags, ...news.tags };
            // Observe — prefer the stable id cache, fall back to discovering
            // the resource's subscription for our destination type. The create
            // response carries the same identifying fields but no timestamps,
            // so keep the local shape to the fields we actually use.
            let subscription = output?.accessLogSubscriptionId
                ? yield* observe(output.accessLogSubscriptionId)
                : yield* findByDestinationType(news.resourceIdentifier, news.destinationArn);
            // Ensure — create if missing. A ConflictException means a
            // subscription for this destination type already exists (a race);
            // recover it and converge below.
            if (!subscription) {
                const created = yield* retryOnConflict(vpclattice.createAccessLogSubscription({
                    resourceIdentifier: news.resourceIdentifier,
                    destinationArn: news.destinationArn,
                    serviceNetworkLogType: news.serviceNetworkLogType,
                    tags: desiredTags,
                })).pipe(Effect.catchTag("ConflictException", () => findByDestinationType(news.resourceIdentifier, news.destinationArn)));
                if (!created) {
                    return yield* Effect.fail(new Error("Failed to create access log subscription"));
                }
                subscription = created;
            }
            // Sync destination — mutable within the same destination type.
            if (normalizeDestinationArn(subscription.destinationArn) !==
                normalizeDestinationArn(news.destinationArn)) {
                yield* vpclattice.updateAccessLogSubscription({
                    accessLogSubscriptionIdentifier: subscription.id,
                    destinationArn: news.destinationArn,
                });
            }
            yield* syncTags(subscription.arn, desiredTags);
            yield* session.note(subscription.arn);
            return {
                accessLogSubscriptionId: subscription.id,
                accessLogSubscriptionArn: subscription.arn,
                resourceId: subscription.resourceId,
                resourceArn: subscription.resourceArn,
                destinationArn: news.destinationArn,
                tags: desiredTags,
            };
        }),
        // Sub-resource: subscriptions are keyed by their service network /
        // service and are removed with it, so nuke has nothing to enumerate.
        list: () => Effect.succeed([]),
        delete: Effect.fn(function* ({ output }) {
            yield* retryOnConflict(vpclattice.deleteAccessLogSubscription({
                accessLogSubscriptionIdentifier: output.accessLogSubscriptionId,
            })).pipe(Effect.catchTag("ResourceNotFoundException", () => Effect.void));
        }),
    };
}));
//# sourceMappingURL=AccessLogSubscription.js.map