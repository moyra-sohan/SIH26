import { consumeBusEvents, } from "../EventBridge/EventSource.js";
const DETAIL_TYPES = {
    cluster: "EMR Cluster State Change",
    step: "EMR Step Status Change",
    "instance-group": "EMR Instance Group State Change",
    "instance-fleet": "EMR Instance Fleet State Change",
    "auto-scaling": "EMR Auto Scaling Policy State Change",
};
/**
 * Event source connecting Amazon EMR notifications to the hosting compute.
 * EMR publishes every cluster state change, step status change, instance
 * group/fleet state change, and auto-scaling policy state change to the
 * account's default EventBridge bus (source `aws.emr`); this subscribes the
 * host Function to those events so it can alert on failed steps or chain
 * post-cluster automation.
 *
 * EMR publishes to EventBridge automatically — no additional resource is
 * created besides the EventBridge rule targeting the host. Provide the
 * host-specific implementation layer (e.g. `AWS.Lambda.EventSource`) on the
 * Function effect.
 *
 * ### Consuming Cluster Events
 * **Example:** Alert On Failed Steps
 * ```typescript
 * import * as AWS from "alchemy/AWS";
 *
 * export default AlertFunction.make(
 *   { main: import.meta.url },
 *   Effect.gen(function* () {
 *     yield* AWS.EMR.consumeClusterEvents(
 *       { kinds: ["step"] },
 *       (events) =>
 *         Stream.runForEach(events, (event) =>
 *           event.detail.state === "FAILED"
 *             ? Effect.log(`step ${event.detail.stepId} failed`)
 *             : Effect.void,
 *         ),
 *     );
 *     return {};
 *   }).pipe(Effect.provide(AWS.Lambda.EventSource)),
 * );
 * ```
 */
export const consumeClusterEvents = (props, process) => consumeBusEvents(props.id ?? "EMRClusterEvents", {
    source: ["aws.emr"],
    "detail-type": (props.kinds ?? ["cluster"]).map((kind) => DETAIL_TYPES[kind]),
    ...(props.clusterIds !== undefined
        ? { detail: { clusterId: [...props.clusterIds] } }
        : {}),
}, { description: props.description, state: props.state }, process);
//# sourceMappingURL=ClusterEventSource.js.map