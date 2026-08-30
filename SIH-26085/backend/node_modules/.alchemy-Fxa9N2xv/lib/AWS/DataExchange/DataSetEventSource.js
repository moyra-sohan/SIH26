import { consumeBusEvents, } from "../EventBridge/EventSource.js";
const DETAIL_TYPES = {
    "revision-published": "Revision Published To Data Set",
    "revision-revoked": "Revision Revoked",
    "data-sets-published-to-product": "Data Sets Published To Product",
    "data-set-removed-from-product": "Data Set Removed From Product",
    "update-delayed": "Data Set Update Delayed",
    "data-updated": "Data Updated in Data Set",
    "deprecation-planned": "Deprecation Planned for Data Set",
    "schema-change-planned": "Schema Change Planned for Data Set",
    "auto-export-completed": "Auto-export Job Completed",
    "auto-export-failed": "Auto-export Job Failed",
    "data-grant-accepted": "Data Grant Accepted",
    "data-grant-extended": "Data Grant Extended",
    "data-grant-revoked": "Data Grant Revoked",
};
/**
 * Event source connecting AWS Data Exchange notifications to the hosting
 * compute. Data Exchange publishes subscriber-facing events to the
 * account's default EventBridge bus (source `aws.dataexchange`) — most
 * importantly `Revision Published To Data Set` when a provider publishes
 * fresh data to an entitled data set — and this subscribes the host
 * Function to those events so it can trigger export jobs or downstream
 * pipelines the moment new data arrives.
 *
 * Data Exchange publishes to EventBridge automatically — no additional
 * resource is created besides the EventBridge rule targeting the host.
 * Provide the host-specific implementation layer (e.g.
 * `AWS.Lambda.EventSource`) on the Function effect.
 *
 * ### Consuming Data Exchange Events
 * **Example:** Process Newly Published Revisions
 * ```typescript
 * import * as AWS from "alchemy/AWS";
 *
 * export default IngestFunction.make(
 *   { main: import.meta.url },
 *   Effect.gen(function* () {
 *     yield* AWS.DataExchange.consumeDataSetEvents(
 *       { kinds: ["revision-published", "revision-revoked"] },
 *       (events) =>
 *         Stream.runForEach(events, (event) =>
 *           Effect.log(
 *             `${event["detail-type"]}: revisions ${event.detail.RevisionIds}`,
 *           ),
 *         ),
 *     );
 *     return {};
 *   }).pipe(Effect.provide(AWS.Lambda.EventSource)),
 * );
 * ```
 */
export const consumeDataSetEvents = (props, process) => consumeBusEvents(props.id ?? "DataExchangeEvents", {
    source: ["aws.dataexchange"],
    "detail-type": [
        ...(props.kinds ?? ["revision-published"]).map((kind) => DETAIL_TYPES[kind]),
        ...(props.detailTypes ?? []),
    ],
    ...(props.dataSetIds !== undefined
        ? { resources: [...props.dataSetIds] }
        : {}),
}, { description: props.description, state: props.state }, process);
//# sourceMappingURL=DataSetEventSource.js.map