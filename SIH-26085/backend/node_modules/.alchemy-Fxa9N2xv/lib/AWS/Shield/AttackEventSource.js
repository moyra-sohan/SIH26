import { consumeBusEvents, } from "../EventBridge/EventSource.js";
/**
 * Event source connecting Shield Advanced DDoS attack notifications to the
 * hosting compute. When Shield Advanced detects an attack against a protected
 * resource it posts an event to AWS Health, which delivers it to the
 * account's default EventBridge bus (source `aws.health`, service `SHIELD` —
 * or `ROUTE53` for hosted-zone attacks); this subscribes the host Function to
 * those events so it can page, annotate dashboards, or trigger mitigations.
 *
 * Shield publishes through AWS Health automatically — no additional resource
 * is created besides the EventBridge rule targeting the host, but events only
 * fire for accounts with an active Shield Advanced subscription. Provide the
 * host-specific implementation layer (e.g. `AWS.Lambda.EventSource`) on the
 * Function effect.
 *
 * ### Consuming Attack Events
 * **Example:** Page on Detected DDoS Attacks
 * ```typescript
 * import * as AWS from "alchemy/AWS";
 *
 * export default AlertFunction.make(
 *   { main: import.meta.url },
 *   Effect.gen(function* () {
 *     yield* AWS.Shield.consumeAttackEvents({}, (events) =>
 *       Stream.runForEach(events, (event) =>
 *         Effect.logError(
 *           `Shield: ${event.detail.eventTypeCode} affecting ${
 *             event.detail.affectedEntities?.[0]?.entityValue
 *           }`,
 *         ),
 *       ),
 *     );
 *     return {};
 *   }).pipe(Effect.provide(AWS.Lambda.EventSource)),
 * );
 * ```
 */
export const consumeAttackEvents = (props, process) => consumeBusEvents(props.id ?? "ShieldAttacks", {
    source: ["aws.health"],
    "detail-type": ["AWS Health Event"],
    detail: {
        service: [...(props.services ?? ["SHIELD"])],
        eventTypeCategory: ["issue"],
        ...(props.eventTypeCodes !== undefined
            ? { eventTypeCode: [...props.eventTypeCodes] }
            : {}),
    },
}, { description: props.description, state: props.state }, process);
//# sourceMappingURL=AttackEventSource.js.map