import { consumeBusEvents, } from "../EventBridge/EventSource.js";
/**
 * Event source connecting Amazon DataZone notifications to the hosting
 * compute. DataZone publishes its workflow events — subscription requests
 * being created/accepted/rejected, subscriptions being granted, revoked, or
 * cancelled, data source run state changes, asset changes, and domain
 * changes — to the account's default EventBridge bus (source
 * `aws.datazone`); this subscribes the host Function to those events so it
 * can drive automated approval workflows or downstream syncs.
 *
 * DataZone publishes to EventBridge automatically — no additional resource
 * is created besides the EventBridge rule targeting the host. Provide the
 * host-specific implementation layer (e.g. `AWS.Lambda.EventSource`) on the
 * Function effect.
 *
 * ### Consuming DataZone Events
 * **Example:** Auto-approve Subscription Requests
 * ```typescript
 * import * as AWS from "alchemy/AWS";
 *
 * export default ApprovalFunction.make(
 *   { main: import.meta.url },
 *   Effect.gen(function* () {
 *     const acceptSubscriptionRequest =
 *       yield* AWS.DataZone.AcceptSubscriptionRequest(domain);
 *
 *     yield* AWS.DataZone.consumeDataZoneEvents(
 *       { detailTypes: ["Subscription Request Created"] },
 *       (events) =>
 *         Stream.runForEach(events, (event) =>
 *           Effect.gen(function* () {
 *             const requestId = event.detail.metadata?.id;
 *             if (requestId !== undefined) {
 *               yield* acceptSubscriptionRequest({
 *                 identifier: requestId,
 *                 decisionComment: "auto-approved",
 *               }).pipe(Effect.ignore);
 *             }
 *           }),
 *         ),
 *     );
 *     return {};
 *   }).pipe(
 *     Effect.provide(AWS.Lambda.EventSource),
 *     Effect.provide(AWS.DataZone.AcceptSubscriptionRequestHttp),
 *   ),
 * );
 * ```
 */
export const consumeDataZoneEvents = (props, process) => consumeBusEvents(props.id ?? "DataZoneEvents", {
    source: ["aws.datazone"],
    ...(props.detailTypes !== undefined
        ? { "detail-type": [...props.detailTypes] }
        : {}),
}, { description: props.description, state: props.state }, process);
//# sourceMappingURL=DataZoneEventSource.js.map