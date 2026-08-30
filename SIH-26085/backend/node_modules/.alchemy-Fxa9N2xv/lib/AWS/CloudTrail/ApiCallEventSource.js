import { consumeBusEvents, } from "../EventBridge/EventSource.js";
/**
 * Event source connecting CloudTrail-recorded API calls to the hosting
 * compute. EventBridge receives every **mutating** management API call
 * CloudTrail records (detail-type `AWS API Call via CloudTrail`) on the
 * account's default bus — read-only calls (`Get*`/`List*`/`Describe*`) and
 * data events are not delivered. This subscribes the host Function to those
 * events so it can react to control-plane changes (security automation,
 * config auditing) without polling.
 *
 * EventBridge receives these events automatically — no trail is required and
 * no additional resource is created besides the EventBridge rule targeting
 * the host. Provide the host-specific implementation layer (e.g.
 * `AWS.Lambda.EventSource`) on the Function effect.
 *
 * ### Consuming API Call Events
 * **Example:** React to S3 Bucket Configuration Changes
 * ```typescript
 * import * as AWS from "alchemy/AWS";
 *
 * export default AuditFunction.make(
 *   { main: import.meta.url },
 *   Effect.gen(function* () {
 *     yield* AWS.CloudTrail.consumeApiCallEvents(
 *       {
 *         eventSources: ["s3.amazonaws.com"],
 *         eventNames: ["PutBucketPolicy", "PutBucketAcl"],
 *       },
 *       (events) =>
 *         Stream.runForEach(events, (event) =>
 *           Effect.log(
 *             `${event.detail.eventName} on ${JSON.stringify(
 *               event.detail.requestParameters,
 *             )}`,
 *           ),
 *         ),
 *     );
 *     return {};
 *   }).pipe(Effect.provide(AWS.Lambda.EventSource)),
 * );
 * ```
 */
export const consumeApiCallEvents = (props, process) => consumeBusEvents(props.id ?? "CloudTrailApiCallEvents", {
    "detail-type": ["AWS API Call via CloudTrail"],
    ...(props.eventSources || props.eventNames
        ? {
            detail: {
                ...(props.eventSources
                    ? { eventSource: [...props.eventSources] }
                    : {}),
                ...(props.eventNames ? { eventName: [...props.eventNames] } : {}),
            },
        }
        : {}),
}, { description: props.description, state: props.state }, process);
//# sourceMappingURL=ApiCallEventSource.js.map