import { consumeBusEvents, } from "../EventBridge/EventSource.js";
/**
 * Event source connecting Amazon QuickSight asset events to the hosting
 * compute. QuickSight (Enterprise Edition) publishes create/update/delete
 * outcomes for dashboards, analyses, datasets, data sources, templates,
 * themes, and folders to the account's default EventBridge bus (source
 * `aws.quicksight`, detail-types like `QuickSight Dashboard Creation
 * Successful`); this subscribes the host Function to those events so it can
 * drive continuous-deployment, replication, or backup automation.
 *
 * QuickSight publishes to EventBridge automatically — no additional resource
 * is created besides the EventBridge rule targeting the host. When
 * `detailTypes` is omitted, the rule excludes `AWS Service Event via
 * CloudTrail` so only the native asset events are delivered. Provide the
 * host-specific implementation layer (e.g. `AWS.Lambda.EventSource`) on the
 * Function effect.
 *
 * ### Consuming Asset Events
 * **Example:** React To Dashboard Publishes
 * ```typescript
 * import * as AWS from "alchemy/AWS";
 *
 * export default DashboardReactor.make(
 *   { main: import.meta.url },
 *   Effect.gen(function* () {
 *     yield* AWS.QuickSight.consumeAssetEvents(
 *       {
 *         detailTypes: [
 *           "QuickSight Dashboard Creation Successful",
 *           "QuickSight Dashboard Update Successful",
 *         ],
 *       },
 *       (events) =>
 *         Stream.runForEach(events, (event) =>
 *           Effect.log(`dashboard ${event.detail.resourceId} published`),
 *         ),
 *     );
 *     return {};
 *   }).pipe(Effect.provide(AWS.Lambda.EventSource)),
 * );
 * ```
 */
export const consumeAssetEvents = (props, process) => consumeBusEvents(props.id ?? "QuickSightAssetEvents", {
    source: ["aws.quicksight"],
    "detail-type": props.detailTypes
        ? [...props.detailTypes]
        : [{ "anything-but": ["AWS Service Event via CloudTrail"] }],
}, { description: props.description, state: props.state }, process);
//# sourceMappingURL=AssetEventSource.js.map