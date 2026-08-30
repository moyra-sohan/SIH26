import { consumeBusEvents, } from "../EventBridge/EventSource.js";
const DETAIL_TYPES = {
    deployment: "CodeDeploy Deployment State-change Notification",
    instance: "CodeDeploy Instance State-change Notification",
};
/**
 * Event source connecting CodeDeploy deployment notifications to the
 * hosting compute. CodeDeploy publishes every deployment state change (and
 * per-instance state change) to the account's default EventBridge bus
 * (source `aws.codedeploy`); this subscribes the host Function to those
 * events so it can alert on failed deployments or chain post-deploy
 * automation.
 *
 * CodeDeploy publishes to EventBridge automatically — no additional
 * resource is created besides the EventBridge rule targeting the host.
 * Provide the host-specific implementation layer (e.g.
 * `AWS.Lambda.EventSource`) on the Function effect.
 *
 * ### Consuming Deployment Events
 * **Example:** Alert On Failed Deployments
 * ```typescript
 * import * as AWS from "alchemy/AWS";
 *
 * export default AlertFunction.make(
 *   { main: import.meta.url },
 *   Effect.gen(function* () {
 *     yield* AWS.CodeDeploy.consumeDeploymentEvents(
 *       { kinds: ["deployment"] },
 *       (events) =>
 *         Stream.runForEach(events, (event) =>
 *           event.detail.state === "FAILURE"
 *             ? Effect.log(`deployment ${event.detail.deploymentId} failed`)
 *             : Effect.void,
 *         ),
 *     );
 *     return {};
 *   }).pipe(Effect.provide(AWS.Lambda.EventSource)),
 * );
 * ```
 */
export const consumeDeploymentEvents = (props, process) => consumeBusEvents(props.id ?? "CodeDeployEvents", {
    source: ["aws.codedeploy"],
    "detail-type": (props.kinds ?? ["deployment"]).map((kind) => DETAIL_TYPES[kind]),
    ...(props.applications !== undefined ||
        props.deploymentGroups !== undefined
        ? {
            detail: {
                ...(props.applications !== undefined
                    ? { application: [...props.applications] }
                    : {}),
                ...(props.deploymentGroups !== undefined
                    ? { deploymentGroup: [...props.deploymentGroups] }
                    : {}),
            },
        }
        : {}),
}, { description: props.description, state: props.state }, process);
//# sourceMappingURL=DeploymentEventSource.js.map