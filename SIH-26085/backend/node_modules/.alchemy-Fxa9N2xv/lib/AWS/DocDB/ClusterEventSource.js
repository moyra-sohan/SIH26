import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";
/**
 * Subscribe an Effect handler to change-stream events produced by an Amazon
 * DocumentDB {@link DBCluster}.
 *
 * The underlying Lambda event-source mapping polls the cluster's change stream
 * and delivers batches of change events. Note that DocumentDB change streams
 * must be enabled on the target database/collection (a data-plane operation run
 * against the cluster) before events flow.
 *
 * @param cluster The DocumentDB cluster to consume change events from.
 * @param props Event-source configuration (database, collection, credentials).
 * @param process The handler invoked with a stream of change records.
 *
 * @example Consume change-stream events in a Lambda function
 * ```typescript
 * // inside the Function's Effect.gen, with
 * // Effect.provide(AWS.Lambda.DocDBClusterEventSource)
 * const secretArn = yield* cluster.masterUserSecretArn;
 * yield* AWS.DocDB.consumeClusterChanges(
 *   cluster,
 *   {
 *     databaseName: "app",
 *     collectionName: "orders",
 *     secretArn,
 *     fullDocument: "UpdateLookup",
 *     startingPosition: "LATEST",
 *   },
 *   (stream) =>
 *     stream.pipe(
 *       Stream.runForEach((record) =>
 *         Effect.log(
 *           `${record.event.operationType}: ${JSON.stringify(record.event.documentKey)}`,
 *         ),
 *       ),
 *     ),
 * );
 * ```
 */
export function consumeClusterChanges(cluster, props, process) {
    return ClusterEventSource.use((source) => source(cluster, props, process));
}
export class ClusterEventSource extends Context.Service()("AWS.DocDB.ClusterEventSource") {
}
//# sourceMappingURL=ClusterEventSource.js.map