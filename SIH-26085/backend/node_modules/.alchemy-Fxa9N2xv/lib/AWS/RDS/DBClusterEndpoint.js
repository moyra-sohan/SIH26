import * as rds from "@distilled.cloud/aws/rds";
import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";
import { isResolved } from "../../Diff.js";
import { createPhysicalName } from "../../PhysicalName.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
import { createInternalTags, diffTags } from "../../Tags.js";
/**
 * A custom Aurora cluster endpoint — a DNS name that routes to a chosen
 * subset of a cluster's instances, on top of the built-in writer and reader
 * endpoints of a `DBCluster`.
 *
 * Use it to pin analytics traffic to specific readers or to keep a stable
 * address across instance replacements. Changing the identifier or owning
 * cluster replaces the endpoint; type and membership update in place.
 * ### Creating Custom Endpoints
 * **Example:** Reader Endpoint for a Cluster
 * ```typescript
 * const readers = yield* DBClusterEndpoint("Readers", {
 *   dbClusterIdentifier: cluster.dbClusterIdentifier,
 *   endpointType: "READER",
 * });
 * ```
 *
 * **Example:** Pin Specific Instances
 * ```typescript
 * const analytics = yield* DBClusterEndpoint("Analytics", {
 *   dbClusterIdentifier: cluster.dbClusterIdentifier,
 *   endpointType: "ANY",
 *   staticMembers: [reporting.dbInstanceIdentifier],
 * });
 * ```
 *
 * @resource
 */
export const DBClusterEndpoint = Resource("AWS.RDS.DBClusterEndpoint");
const toAttrs = ({ endpoint, tags, }) => ({
    dbClusterEndpointIdentifier: endpoint.DBClusterEndpointIdentifier ?? "",
    dbClusterEndpointArn: endpoint.DBClusterEndpointArn,
    dbClusterIdentifier: endpoint.DBClusterIdentifier,
    endpoint: endpoint.Endpoint,
    status: endpoint.Status,
    endpointType: endpoint.EndpointType,
    customEndpointType: endpoint.CustomEndpointType,
    staticMembers: endpoint.StaticMembers ?? [],
    excludedMembers: endpoint.ExcludedMembers ?? [],
    tags,
});
export const DBClusterEndpointProvider = () => Provider.effect(DBClusterEndpoint, Effect.gen(function* () {
    const toIdentifier = (id, props) => props.dbClusterEndpointIdentifier
        ? Effect.succeed(props.dbClusterEndpointIdentifier)
        : createPhysicalName({ id, maxLength: 63 });
    const readEndpoint = Effect.fn(function* (identifier) {
        const response = yield* rds
            .describeDBClusterEndpoints({
            DBClusterEndpointIdentifier: identifier,
        })
            .pipe(Effect.catchTag("DBClusterNotFoundFault", () => Effect.succeed(undefined)));
        return response?.DBClusterEndpoints?.[0];
    });
    return {
        stables: ["dbClusterEndpointArn", "dbClusterEndpointIdentifier"],
        // Enumerate every custom cluster endpoint in the account/region.
        // `describeDBClusterEndpoints` with no filter returns custom endpoints
        // across all clusters; system endpoints (EndpointType WRITER/READER)
        // aren't managed via createDBClusterEndpoint, so we keep only CUSTOM
        // ones. Tags aren't returned by describe, so each item carries `{}`
        // (matching `read`'s default when there is no recorded tag set).
        list: () => rds.describeDBClusterEndpoints.pages({}).pipe(Stream.runCollect, Effect.map((chunk) => Array.from(chunk).flatMap((page) => (page.DBClusterEndpoints ?? [])
            .filter((endpoint) => endpoint.EndpointType === "CUSTOM")
            .map((endpoint) => toAttrs({ endpoint, tags: {} }))))),
        diff: Effect.fn(function* ({ id, olds, news }) {
            if (!isResolved(news))
                return;
            if ((yield* toIdentifier(id, olds ?? {})) !== (yield* toIdentifier(id, news))) {
                return { action: "replace" };
            }
            if (olds?.dbClusterIdentifier !== news.dbClusterIdentifier) {
                return { action: "replace" };
            }
        }),
        read: Effect.fn(function* ({ id, olds, output }) {
            const identifier = output?.dbClusterEndpointIdentifier ??
                (yield* toIdentifier(id, olds ??
                    {
                        dbClusterIdentifier: "",
                        endpointType: "READER",
                    }));
            const endpoint = yield* readEndpoint(identifier);
            if (!endpoint?.DBClusterEndpointIdentifier) {
                return undefined;
            }
            return toAttrs({ endpoint, tags: output?.tags ?? {} });
        }),
        reconcile: Effect.fn(function* ({ id, news, output, session }) {
            const identifier = output?.dbClusterEndpointIdentifier ??
                (yield* toIdentifier(id, news));
            const internalTags = yield* createInternalTags(id);
            const desiredTags = { ...internalTags, ...news.tags };
            // Observe — fetch the endpoint's live state.
            let observed = yield* readEndpoint(identifier);
            // Ensure — create if missing. Tolerate
            // `DBClusterEndpointAlreadyExistsFault` as a race with a peer
            // reconciler.
            if (!observed?.DBClusterEndpointIdentifier) {
                yield* rds
                    .createDBClusterEndpoint({
                    DBClusterIdentifier: news.dbClusterIdentifier,
                    DBClusterEndpointIdentifier: identifier,
                    EndpointType: news.endpointType,
                    StaticMembers: news.staticMembers,
                    ExcludedMembers: news.excludedMembers,
                    Tags: Object.entries(desiredTags).map(([Key, Value]) => ({
                        Key,
                        Value,
                    })),
                })
                    .pipe(Effect.catchTag("DBClusterEndpointAlreadyExistsFault", () => Effect.void));
                observed = yield* readEndpoint(identifier);
                if (!observed?.DBClusterEndpointIdentifier) {
                    return yield* Effect.fail(new Error(`DB cluster endpoint '${identifier}' not found after create`));
                }
            }
            else {
                // Sync mutable endpoint config — push desired shape.
                yield* rds.modifyDBClusterEndpoint({
                    DBClusterEndpointIdentifier: identifier,
                    EndpointType: news.endpointType,
                    StaticMembers: news.staticMembers,
                    ExcludedMembers: news.excludedMembers,
                });
                observed = yield* readEndpoint(identifier);
                if (!observed?.DBClusterEndpointIdentifier) {
                    return yield* Effect.fail(new Error(`DB cluster endpoint '${identifier}' not found after update`));
                }
            }
            const dbClusterEndpointArn = observed.DBClusterEndpointArn;
            // Sync tags — diff observed cloud tags against desired. The
            // describeDBClusterEndpoints response does not include tags, so we
            // diff against the previously-recorded tag set on `output`.
            const observedTags = output?.tags ?? {};
            const { removed, upsert } = diffTags(observedTags, desiredTags);
            if (upsert.length > 0 && dbClusterEndpointArn) {
                yield* rds.addTagsToResource({
                    ResourceName: dbClusterEndpointArn,
                    Tags: upsert,
                });
            }
            if (removed.length > 0 && dbClusterEndpointArn) {
                yield* rds.removeTagsFromResource({
                    ResourceName: dbClusterEndpointArn,
                    TagKeys: removed,
                });
            }
            yield* session.note(dbClusterEndpointArn ?? identifier);
            return toAttrs({ endpoint: observed, tags: desiredTags });
        }),
        delete: Effect.fn(function* ({ output }) {
            yield* rds
                .deleteDBClusterEndpoint({
                DBClusterEndpointIdentifier: output.dbClusterEndpointIdentifier,
            })
                .pipe(Effect.catchTag("DBClusterEndpointNotFoundFault", () => Effect.void));
        }),
    };
}));
//# sourceMappingURL=DBClusterEndpoint.js.map