import * as Effect from "effect/Effect";
import { consumeBusEvents, } from "../EventBridge/EventSource.js";
/**
 * Deliver Amplify Hosting deployment status changes (`aws.amplify` /
 * `"Amplify Deployment Status Change"` EventBridge events) to the host
 * Function — e.g. to notify a chat channel on failed builds or kick off
 * cache invalidation when a deploy succeeds.
 *
 * The EventBridge pattern matches every Amplify app in the account and
 * region (the pattern must be literal — `Output` values such as `app.appId`
 * do not resolve inside the deployed bundle); inspect `event.detail.appId` /
 * `event.detail.branchName` in the handler if multiple apps share the
 * Function. Provide `AWS.Lambda.EventSource` on the Function effect to
 * implement the subscription.
 *
 * ### Reacting To Deployments
 * **Example:** Alert on Failed Builds
 * ```typescript
 * yield* AWS.Amplify.consumeDeploymentStatusChanges(
 *   { jobStatus: ["FAILED"] },
 *   (events) =>
 *     Stream.runForEach(events, (event) =>
 *       Effect.log(
 *         `build ${event.detail.jobId} failed on ` +
 *           `${event.detail.appId}/${event.detail.branchName}`,
 *       ),
 *     ),
 * );
 * ```
 *
 * **Example:** Register the Event Source inside a Lambda Function
 * ```typescript
 * import * as AWS from "alchemy/AWS";
 *
 * export class DeployHooks extends AWS.Lambda.Function<AWS.Lambda.Function>()(
 *   "DeployHooks",
 * ) {}
 *
 * export default DeployHooks.make(
 *   { main: import.meta.url },
 *   Effect.gen(function* () {
 *     yield* AWS.Amplify.consumeDeploymentStatusChanges(
 *       { jobStatus: ["SUCCEED"] },
 *       (events) =>
 *         Stream.runForEach(events, (event) =>
 *           Effect.log(`deployed ${event.detail.branchName}`),
 *         ),
 *     );
 *     return {};
 *   }).pipe(Effect.provide(AWS.Lambda.EventSource)),
 * );
 * ```
 */
export const consumeDeploymentStatusChanges = (props, process) => Effect.gen(function* () {
    const { id, jobStatus, ...routeProps } = props;
    yield* consumeBusEvents(`${id ?? "Amplify"}-DeploymentStatusChanges`, {
        source: ["aws.amplify"],
        "detail-type": ["Amplify Deployment Status Change"],
        ...(jobStatus && jobStatus.length > 0 ? { detail: { jobStatus } } : {}),
    }, routeProps, process);
});
//# sourceMappingURL=AppEventSource.js.map