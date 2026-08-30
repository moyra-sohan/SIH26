import { consumeBusEvents, } from "../EventBridge/EventSource.js";
const DETAIL_TYPES = {
    state: "CodeBuild Build State Change",
    phase: "CodeBuild Build Phase Change",
};
/**
 * Event source connecting CodeBuild build notifications to the hosting
 * compute. CodeBuild publishes every build state change (and per-phase
 * completion) to the account's default EventBridge bus (source
 * `aws.codebuild`); this subscribes the host Function to those events so it
 * can alert on failed builds or chain post-build automation.
 *
 * CodeBuild publishes to EventBridge automatically — no additional resource
 * is created besides the EventBridge rule targeting the host. Provide the
 * host-specific implementation layer (e.g. `AWS.Lambda.EventSource`) on the
 * Function effect.
 *
 * ### Consuming Build Events
 * **Example:** Alert On Failed Builds
 * ```typescript
 * import * as AWS from "alchemy/AWS";
 *
 * export default AlertFunction.make(
 *   { main: import.meta.url },
 *   Effect.gen(function* () {
 *     yield* AWS.CodeBuild.consumeBuildEvents(
 *       { kinds: ["state"] },
 *       (events) =>
 *         Stream.runForEach(events, (event) =>
 *           event.detail["build-status"] === "FAILED"
 *             ? Effect.log(`build ${event.detail["build-id"]} failed`)
 *             : Effect.void,
 *         ),
 *     );
 *     return {};
 *   }).pipe(Effect.provide(AWS.Lambda.EventSource)),
 * );
 * ```
 */
export const consumeBuildEvents = (props, process) => consumeBusEvents(props.id ?? "CodeBuildEvents", {
    source: ["aws.codebuild"],
    "detail-type": (props.kinds ?? ["state"]).map((kind) => DETAIL_TYPES[kind]),
    ...(props.projectNames !== undefined
        ? { detail: { "project-name": [...props.projectNames] } }
        : {}),
}, { description: props.description, state: props.state }, process);
//# sourceMappingURL=BuildEventSource.js.map