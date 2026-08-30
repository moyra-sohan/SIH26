import { consumeBusEvents, } from "../EventBridge/EventSource.js";
const DETAIL_TYPES = {
    "task-state-change": "ECS Task State Change",
    "container-instance-state-change": "ECS Container Instance State Change",
    "deployment-state-change": "ECS Deployment State Change",
    "service-action": "ECS Service Action",
};
/**
 * Event source connecting Amazon ECS notifications to the hosting compute.
 * ECS publishes task state changes, container-instance state changes,
 * deployment state changes, and service actions to the account's default
 * EventBridge bus (source `aws.ecs`); this subscribes the host Function to
 * those events so it can react when a task stops, a deployment completes or
 * rolls back, or an instance drops out.
 *
 * ECS publishes to EventBridge automatically — no additional resource is
 * created besides the EventBridge rule targeting the host. Provide the
 * host-specific implementation layer (e.g. `AWS.Lambda.EventSource`) on the
 * Function effect.
 *
 * ### Consuming Cluster Events
 * **Example:** React When A Task Stops
 * ```typescript
 * import * as AWS from "alchemy/AWS";
 *
 * export default AlertFunction.make(
 *   { main: import.meta.url },
 *   Effect.gen(function* () {
 *     yield* AWS.ECS.consumeClusterEvents(
 *       { kinds: ["task-state-change"], clusterArns: [cluster.clusterArn] },
 *       (events) =>
 *         Stream.runForEach(events, (event) =>
 *           event.detail.lastStatus === "STOPPED"
 *             ? Effect.logError(`task stopped: ${event.detail.stoppedReason}`)
 *             : Effect.log(`task ${event.detail.lastStatus}`),
 *         ),
 *     );
 *     return {};
 *   }).pipe(Effect.provide(AWS.Lambda.EventSource)),
 * );
 * ```
 *
 * **Example:** Alert On Failed Deployments
 * ```typescript
 * yield* AWS.ECS.consumeClusterEvents(
 *   { kinds: ["deployment-state-change"] },
 *   (events) =>
 *     Stream.runForEach(events, (event) =>
 *       event.detail.eventName === "SERVICE_DEPLOYMENT_FAILED"
 *         ? Effect.logError(`deployment failed: ${event.detail.reason}`)
 *         : Effect.void,
 *     ),
 * );
 * ```
 */
export const consumeClusterEvents = (props, process) => consumeBusEvents(props.id ?? "EcsClusterEvents", {
    source: ["aws.ecs"],
    "detail-type": (props.kinds ?? ["task-state-change"]).map((kind) => DETAIL_TYPES[kind]),
    ...(props.clusterArns !== undefined
        ? { detail: { clusterArn: [...props.clusterArns] } }
        : {}),
}, { description: props.description, state: props.state }, process);
//# sourceMappingURL=ClusterEventSource.js.map