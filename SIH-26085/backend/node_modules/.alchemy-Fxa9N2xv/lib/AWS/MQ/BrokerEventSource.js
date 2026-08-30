import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";
/**
 * Subscribe an Effect handler to messages produced by an Amazon MQ
 * {@link Broker}. Lambda polls the named broker queue(s) using the supplied
 * Secrets Manager credentials and invokes the handler with a stream of
 * messages.
 *
 * Call it in the function's init phase and provide the host implementation
 * layer (`Lambda.BrokerEventSource`) on the function Effect — the
 * event-source mapping, IAM grants, and runtime dispatch are registered
 * automatically.
 *
 * @example
 * ```typescript
 * // init — inside the Lambda function's setup Effect
 * const broker = yield* MQ.Broker("Orders", {
 *   engineType: "ACTIVEMQ",
 *   engineVersion: "5.18",
 *   hostInstanceType: "mq.t3.micro",
 *   users: [{ username: "app", password: appPassword }],
 * });
 *
 * yield* MQ.consumeBrokerMessages(
 *   broker,
 *   {
 *     queues: ["orders"],
 *     credentialsSecretArn: secret.secretArn,
 *     batchSize: 10,
 *   },
 *   (messages) =>
 *     messages.pipe(
 *       Stream.runForEach((message) =>
 *         // message bodies arrive base64-encoded
 *         Effect.log(atob(message.data ?? "")),
 *       ),
 *     ),
 * );
 * ```
 *
 * Provide the Lambda implementation layer on the function:
 * ```typescript
 * export default OrdersFunction.make(
 *   { main },
 *   Effect.gen(function* () {
 *     // ... consumeBrokerMessages(...) as above
 *     return { fetch: Effect.succeed(HttpServerResponse.text("ok")) };
 *   }).pipe(Effect.provide(Lambda.BrokerEventSource)),
 * );
 * ```
 *
 * @param broker The Amazon MQ broker to consume from.
 * @param props Queues, credentials secret, and batching configuration.
 * @param process The handler invoked with a stream of MQ messages.
 */
export function consumeBrokerMessages(broker, props, process) {
    return BrokerEventSource.use((source) => source(broker, props, process));
}
/**
 * Event source connecting an Amazon MQ {@link Broker} to the hosting Lambda
 * function. Prefer the {@link consumeBrokerMessages} helper; this service is
 * the underlying contract, implemented by the `Lambda.BrokerEventSource`
 * layer (which registers the event-source mapping, IAM grants, and runtime
 * dispatch).
 *
 * **Example:** Example
 * ```typescript
 * // equivalent to consumeBrokerMessages(broker, props, process)
 * yield* BrokerEventSource.use((source) =>
 *   source(broker, props, process),
 * );
 * ```
 *
 * @binding
 */
export class BrokerEventSource extends Context.Service()("AWS.MQ.BrokerEventSource") {
}
//# sourceMappingURL=BrokerEventSource.js.map