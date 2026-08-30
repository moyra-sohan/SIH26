import { consumeBusEvents, } from "../EventBridge/EventSource.js";
/**
 * Event source connecting Glue crawler state changes to the hosting
 * compute. Glue publishes `Glue Crawler State Change` events to the
 * account's default EventBridge bus (source `aws.glue`) when a crawl
 * starts, succeeds, or fails; this subscribes the host Function to those
 * events so it can kick off downstream processing once the Data Catalog is
 * refreshed.
 *
 * Glue publishes to EventBridge automatically — no additional resource is
 * created besides the EventBridge rule targeting the host. Provide the
 * host-specific implementation layer (e.g. `AWS.Lambda.EventSource`) on the
 * Function effect.
 *
 * ### Consuming Crawler Events
 * **Example:** Run Downstream Work After a Crawl
 * ```typescript
 * import * as AWS from "alchemy/AWS";
 *
 * export default PipelineFunction.make(
 *   { main: import.meta.url },
 *   Effect.gen(function* () {
 *     yield* AWS.Glue.consumeCrawlerEvents(
 *       { states: ["Succeeded"] },
 *       (events) =>
 *         Stream.runForEach(events, (event) =>
 *           Effect.log(`catalog refreshed by ${event.detail.crawlerName}`),
 *         ),
 *     );
 *     return {};
 *   }).pipe(Effect.provide(AWS.Lambda.EventSource)),
 * );
 * ```
 */
export const consumeCrawlerEvents = (props, process) => consumeBusEvents(props.id ?? "GlueCrawlerEvents", {
    source: ["aws.glue"],
    "detail-type": ["Glue Crawler State Change"],
    ...(props.crawlerNames !== undefined || props.states !== undefined
        ? {
            detail: {
                ...(props.crawlerNames !== undefined
                    ? { crawlerName: [...props.crawlerNames] }
                    : {}),
                ...(props.states !== undefined
                    ? { state: [...props.states] }
                    : {}),
            },
        }
        : {}),
}, { description: props.description, state: props.state }, process);
//# sourceMappingURL=CrawlerEventSource.js.map