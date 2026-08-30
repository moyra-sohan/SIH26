import { consumeBusEvents, } from "../EventBridge/EventSource.js";
const DETAIL_TYPES = {
    "cache-created": "Cache Created",
    "cache-creation-failed": "Cache Creation Failed",
    "cache-updated": "Cache Updated",
    "cache-update-failed": "Cache Update Failed",
    "cache-deleted": "Cache Deleted",
    "cache-limit-approaching": "Cache Limit Approaching",
    "snapshot-created": "Snapshot Created",
    "snapshot-creation-failed": "Snapshot Creation Failed",
    "snapshot-copy-failed": "Snapshot Copy Failed",
    "snapshot-export-failed": "Snapshot Export Failed",
};
/**
 * Event source connecting ElastiCache notifications to the hosting compute.
 * ElastiCache publishes cache and snapshot lifecycle events — creations,
 * updates, deletions, failures, approaching usage limits — to the account's
 * default EventBridge bus (source `aws.elasticache`); this subscribes the
 * host Function to those events so it can alert on failed snapshots or a
 * cache nearing its usage limits.
 *
 * ElastiCache publishes to EventBridge automatically — no additional
 * resource is created besides the EventBridge rule targeting the host.
 * Provide the host-specific implementation layer (e.g.
 * `AWS.Lambda.EventSource`) on the Function effect.
 *
 * ### Consuming Cache Events
 * **Example:** Alert When a Cache Approaches Its Usage Limit
 * ```typescript
 * import * as AWS from "alchemy/AWS";
 *
 * export default AlertFunction.make(
 *   { main: import.meta.url },
 *   Effect.gen(function* () {
 *     yield* AWS.ElastiCache.consumeCacheEvents(
 *       { kinds: ["cache-limit-approaching", "snapshot-creation-failed"] },
 *       (events) =>
 *         Stream.runForEach(events, (event) =>
 *           Effect.logError(
 *             `${event["detail-type"]}: ${event.resources.join(", ")}`,
 *           ),
 *         ),
 *     );
 *     return {};
 *   }).pipe(Effect.provide(AWS.Lambda.EventSource)),
 * );
 * ```
 */
export const consumeCacheEvents = (props, process) => consumeBusEvents(props.id ?? "ElastiCacheEvents", {
    source: ["aws.elasticache"],
    ...(props.kinds !== undefined
        ? { "detail-type": props.kinds.map((kind) => DETAIL_TYPES[kind]) }
        : {}),
    ...(props.resourceArns !== undefined
        ? { resources: [...props.resourceArns] }
        : {}),
}, { description: props.description, state: props.state }, process);
//# sourceMappingURL=CacheEventSource.js.map