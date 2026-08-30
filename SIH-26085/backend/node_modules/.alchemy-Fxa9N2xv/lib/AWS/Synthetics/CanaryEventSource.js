import { consumeBusEvents, } from "../EventBridge/EventSource.js";
/**
 * Event source connecting CloudWatch Synthetics canary events to the
 * hosting compute. Synthetics publishes canary status changes and per-run
 * pass/fail results to the account's default EventBridge bus (source
 * `aws.synthetics`); this subscribes the host Function to those events so
 * it can page on failed runs, annotate deploy dashboards, or kick off
 * remediation.
 *
 * Synthetics publishes to EventBridge automatically — no additional
 * resource is created besides the EventBridge rule targeting the host.
 * Provide the host-specific implementation layer (e.g.
 * `AWS.Lambda.EventSource`) on the Function effect.
 *
 * ### Consuming Canary Events
 * **Example:** Page on Failed Canary Runs
 * ```typescript
 * import * as AWS from "alchemy/AWS";
 *
 * export default AlertFunction.make(
 *   { main: import.meta.url },
 *   Effect.gen(function* () {
 *     const canary = yield* AWS.Synthetics.Canary("ApiMonitor", {
 *       script: canaryScript,
 *       artifactS3Location: artifactLocation,
 *       start: true,
 *     });
 *
 *     yield* AWS.Synthetics.consumeCanaryEvents(
 *       {
 *         canaryNames: [canary.canaryName],
 *         detailTypes: ["Synthetics Canary TestRun Failure"],
 *       },
 *       (events) =>
 *         Stream.runForEach(events, (event) =>
 *           Effect.logError(
 *             `canary ${event.detail["canary-name"]} run failed`,
 *           ),
 *         ),
 *     );
 *     return {};
 *   }).pipe(Effect.provide(AWS.Lambda.EventSource)),
 * );
 * ```
 */
export const consumeCanaryEvents = (props, process) => consumeBusEvents(props.id ?? "SyntheticsCanaryEvents", {
    source: ["aws.synthetics"],
    "detail-type": [
        ...(props.detailTypes ?? [
            "Synthetics Canary Status Change",
            "Synthetics Canary TestRun Successful",
            "Synthetics Canary TestRun Failure",
        ]),
    ],
    ...(props.canaryNames !== undefined
        ? { detail: { "canary-name": [...props.canaryNames] } }
        : {}),
}, { description: props.description, state: props.state }, process);
//# sourceMappingURL=CanaryEventSource.js.map