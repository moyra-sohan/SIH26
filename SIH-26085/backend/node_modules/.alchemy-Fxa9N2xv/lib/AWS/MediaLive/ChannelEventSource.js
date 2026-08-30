import { consumeBusEvents, } from "../EventBridge/EventSource.js";
const DETAIL_TYPES = {
    "state-change": "MediaLive Channel State Change",
    alert: "MediaLive Channel Alert",
    "input-change": "MediaLive Channel Input Change",
    "multiplex-state-change": "MediaLive Multiplex State Change",
    "multiplex-alert": "MediaLive Multiplex Alert",
};
/**
 * Event source connecting AWS Elemental MediaLive notifications to the
 * hosting compute. MediaLive publishes channel state changes
 * (IDLE/STARTING/RUNNING/STOPPING transitions), channel alerts (a lost
 * input, a failed output — SET and CLEARED), active-input changes, and
 * their multiplex equivalents to the account's default EventBridge bus
 * (source `aws.medialive`); this subscribes the host Function to those
 * events so it can page an operator, trigger automated pipeline recovery,
 * or reconcile a broadcast schedule.
 *
 * MediaLive publishes to EventBridge automatically — no additional
 * resource is created besides the EventBridge rule targeting the host.
 * Provide the host-specific implementation layer (e.g.
 * `AWS.Lambda.EventSource`) on the Function effect.
 *
 * ### Consuming Channel Events
 * **Example:** Page an Operator When a Channel Raises an Alert
 * ```typescript
 * import * as AWS from "alchemy/AWS";
 *
 * export default MonitorFunction.make(
 *   { main: import.meta.url },
 *   Effect.gen(function* () {
 *     yield* AWS.MediaLive.consumeChannelEvents(
 *       { kinds: ["alert", "state-change"] },
 *       (events) =>
 *         Stream.runForEach(events, (event) =>
 *           event.detail.alarm_state === "SET"
 *             ? Effect.log(`channel alert: ${event.detail.message}`)
 *             : Effect.void,
 *         ),
 *     );
 *     return {};
 *   }).pipe(Effect.provide(AWS.Lambda.EventSource)),
 * );
 * ```
 */
export const consumeChannelEvents = (props, process) => consumeBusEvents(props.id ?? "MediaLiveChannelEvents", {
    source: ["aws.medialive"],
    "detail-type": (props.kinds ?? ["state-change"]).map((kind) => DETAIL_TYPES[kind]),
    ...(props.channelArns !== undefined
        ? { resources: [...props.channelArns] }
        : {}),
}, { description: props.description, state: props.state }, process);
//# sourceMappingURL=ChannelEventSource.js.map