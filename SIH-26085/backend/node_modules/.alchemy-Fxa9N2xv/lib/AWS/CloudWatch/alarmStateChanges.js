/**
 * Builds an EventBridge event pattern for CloudWatch alarm state changes,
 * for use with the EventBridge event source / routing helpers.
 *
 * @example Consume alarm state changes with a Lambda handler
 * ```typescript
 * yield* AWS.EventBridge.consumeBusEvents(
 *   bus,
 *   AWS.CloudWatch.alarmStateChanges({ states: ["ALARM"] }),
 *   (events) =>
 *     events.pipe(
 *       Stream.runForEach((event) => Effect.log(event.detail)),
 *     ),
 * );
 * ```
 */
export const alarmStateChanges = ({ alarmNames, states, previousStates, } = {}) => ({
    source: ["aws.cloudwatch"],
    "detail-type": ["CloudWatch Alarm State Change"],
    detail: {
        ...(alarmNames ? { alarmName: alarmNames } : {}),
        ...(states ? { state: { value: states } } : {}),
        ...(previousStates ? { previousState: { value: previousStates } } : {}),
    },
});
//# sourceMappingURL=alarmStateChanges.js.map