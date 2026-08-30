import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";
import * as Binding from "../../Binding.js";
export const KafkaEventSource = Binding.Service("AWS.Kafka.KafkaEventSource");
/**
 * Subscribe a runtime to records from one or more topics on an MSK
 * {@link ServerlessCluster}.
 *
 * The Lambda runtime implementation grants the IAM actions MSK IAM
 * authentication requires, creates an event source mapping pointing at the
 * cluster, and forwards matching `aws:kafka` records into the supplied
 * `Stream`.
 *
 * @example Consume the "orders" topic
 * ```typescript
 * yield* AWS.Kafka.consumeKafkaTopic(
 *   cluster,
 *   { topics: ["orders"], startingPosition: "TRIM_HORIZON" },
 *   (records) =>
 *     records.pipe(
 *       Stream.runForEach((record) =>
 *         Effect.log(Buffer.from(record.value, "base64").toString("utf8")),
 *       ),
 *     ),
 * );
 * ```
 */
export const consumeKafkaTopic = (cluster, props, process) => KafkaEventSource.use((source) => source(cluster, props, process));
//# sourceMappingURL=ClusterEventSource.js.map