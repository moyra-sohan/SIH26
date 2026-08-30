import { consumeBusEvents, } from "../EventBridge/EventSource.js";
/**
 * Event source connecting Cost Anomaly Detection to the hosting compute.
 * When an {@link AnomalyMonitor} detects a cost anomaly, Cost Explorer
 * publishes an `Anomaly Detected` event (source `aws.ce`, best-effort
 * delivery) to the account's default EventBridge bus; this subscribes the
 * host Function to those events so it can page, open tickets, or trigger
 * automated cost-control actions the moment unusual spend appears.
 *
 * Cost Anomaly Detection publishes to EventBridge automatically — no
 * additional resource is created besides the EventBridge rule targeting
 * the host. Events are delivered to the Cost Anomaly Detection home region
 * (`us-east-1`), so deploy the consuming stack there. Provide the
 * host-specific implementation layer (e.g. `AWS.Lambda.EventSource`) on
 * the Function effect.
 *
 * ### Consuming Anomaly Events
 * **Example:** React To Detected Cost Anomalies
 * ```typescript
 * import * as AWS from "alchemy/AWS";
 * import * as Stream from "effect/Stream";
 *
 * export default AlertFunction.make(
 *   { main: import.meta.url },
 *   Effect.gen(function* () {
 *     yield* AWS.CostExplorer.consumeAnomalyEvents({}, (events) =>
 *       Stream.runForEach(events, (event) =>
 *         Effect.log(
 *           `anomaly ${event.detail.anomalyId}: $${event.detail.impact?.totalImpact} on ${event.detail.dimensionValue}`,
 *         ),
 *       ),
 *     );
 *     return {};
 *   }).pipe(Effect.provide(AWS.Lambda.EventSource)),
 * );
 * ```
 *
 * **Example:** Only Anomalies From One Monitor
 * ```typescript
 * yield* AWS.CostExplorer.consumeAnomalyEvents(
 *   { monitorArns: ["arn:aws:ce::123456789012:anomalymonitor/abcd..."] },
 *   (events) =>
 *     Stream.runForEach(events, (event) => Effect.log(event.detail)),
 * );
 * ```
 */
export const consumeAnomalyEvents = (props, process) => consumeBusEvents(props.id ?? "CostAnomalyEvents", {
    source: ["aws.ce"],
    "detail-type": ["Anomaly Detected"],
    ...(props.monitorArns !== undefined
        ? { resources: [...props.monitorArns] }
        : {}),
}, { description: props.description, state: props.state }, process);
//# sourceMappingURL=AnomalyEventSource.js.map