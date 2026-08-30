import { consumeBusEvents, } from "../EventBridge/EventSource.js";
const DETAIL_TYPES = {
    compliance: "Config Rules Compliance Change",
    "configuration-item": "Config Configuration Item Change",
    "snapshot-delivery": "Config Configuration Snapshot Delivery Status",
    "history-delivery": "Config Configuration History Delivery Status",
};
/**
 * Event source connecting AWS Config notifications to the hosting compute.
 * AWS Config publishes rule compliance changes and configuration item
 * changes to the account's default EventBridge bus (source `aws.config`);
 * this subscribes the host Function to those events so it can alert on
 * noncompliant resources or chain remediation automation.
 *
 * AWS Config publishes to EventBridge automatically — no additional
 * resource is created besides the EventBridge rule targeting the host.
 * Provide the host-specific implementation layer (e.g.
 * `AWS.Lambda.EventSource`) on the Function effect.
 *
 * ### Consuming Config Events
 * **Example:** Alert On Noncompliant Resources
 * ```typescript
 * import * as AWS from "alchemy/AWS";
 *
 * export default AlertFunction.make(
 *   { main: import.meta.url },
 *   Effect.gen(function* () {
 *     yield* AWS.Config.consumeConfigEvents(
 *       { kinds: ["compliance"] },
 *       (events) =>
 *         Stream.runForEach(events, (event) =>
 *           Effect.log(
 *             `${event.detail.configRuleName}: ${event.detail.resourceId} is now ` +
 *               `${(event.detail.newEvaluationResult as any)?.complianceType}`,
 *           ),
 *         ),
 *     );
 *     return {};
 *   }).pipe(Effect.provide(AWS.Lambda.EventSource)),
 * );
 * ```
 */
export const consumeConfigEvents = (props, process) => {
    const detail = {
        ...(props.configRuleNames !== undefined
            ? { configRuleName: [...props.configRuleNames] }
            : {}),
        ...(props.resourceTypes !== undefined
            ? { resourceType: [...props.resourceTypes] }
            : {}),
    };
    return consumeBusEvents(props.id ?? "ConfigEvents", {
        source: ["aws.config"],
        "detail-type": (props.kinds ?? ["compliance"]).map((kind) => DETAIL_TYPES[kind]),
        ...(Object.keys(detail).length > 0 ? { detail } : {}),
    }, { description: props.description, state: props.state }, process);
};
//# sourceMappingURL=ConfigEventSource.js.map