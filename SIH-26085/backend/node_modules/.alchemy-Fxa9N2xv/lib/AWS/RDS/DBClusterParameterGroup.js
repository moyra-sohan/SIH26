import * as rds from "@distilled.cloud/aws/rds";
import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";
import { isResolved } from "../../Diff.js";
import { createPhysicalName } from "../../PhysicalName.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
import { createInternalTags, diffTags } from "../../Tags.js";
/**
 * An Aurora cluster parameter group — cluster-wide engine settings shared by
 * every instance in a `DBCluster`.
 *
 * Name, family, and description changes force a replacement (RDS has no
 * modify API for these); tags update in place.
 * ### Creating a Cluster Parameter Group
 * **Example:** Parameter Group for Aurora Postgres 16
 * ```typescript
 * const clusterParams = yield* DBClusterParameterGroup("ClusterParams", {
 *   family: "aurora-postgresql16",
 *   description: "Cluster-wide settings for the app database",
 * });
 * ```
 *
 * **Example:** Attach to a Cluster
 * ```typescript
 * const cluster = yield* DBCluster("Cluster", {
 *   engine: "aurora-postgresql",
 *   dbClusterParameterGroupName: clusterParams.dbClusterParameterGroupName,
 * });
 * ```
 *
 * @resource
 */
export const DBClusterParameterGroup = Resource("AWS.RDS.DBClusterParameterGroup");
export const DBClusterParameterGroupProvider = () => Provider.effect(DBClusterParameterGroup, Effect.gen(function* () {
    const toName = (id, props) => props.dbClusterParameterGroupName
        ? Effect.succeed(props.dbClusterParameterGroupName)
        : createPhysicalName({ id, maxLength: 255 });
    const readGroup = Effect.fn(function* (name) {
        const response = yield* rds
            .describeDBClusterParameterGroups({
            DBClusterParameterGroupName: name,
        })
            .pipe(Effect.catchTag("DBParameterGroupNotFoundFault", () => Effect.succeed(undefined)));
        return response?.DBClusterParameterGroups?.[0];
    });
    return {
        stables: ["dbClusterParameterGroupArn", "dbClusterParameterGroupName"],
        list: () => 
        // AWS account/region collection (pattern (a)): exhaustively paginate
        // describeDBClusterParameterGroups and map each group to the exact
        // `read` Attributes shape. `read` derives `tags` from the cached
        // output (the describe response does not surface tags), so list
        // returns `tags: {}` to match — a future read/delete can hydrate
        // them via listTagsForResource. Per-item not-found
        // (DBParameterGroupNotFoundFault) cannot occur here: enumeration
        // passes no name, so the describe never targets a single group.
        rds.describeDBClusterParameterGroups.pages({}).pipe(Stream.runCollect, Effect.map((chunk) => Array.from(chunk).flatMap((page) => (page.DBClusterParameterGroups ?? [])
            .filter((g) => g.DBClusterParameterGroupName != null &&
            // AWS-managed `default.*` groups cannot be deleted
            // (InvalidDBParameterGroupStateFault) — don't enumerate.
            !g.DBClusterParameterGroupName.startsWith("default."))
            .map((g) => ({
            dbClusterParameterGroupName: g.DBClusterParameterGroupName,
            dbClusterParameterGroupArn: g.DBClusterParameterGroupArn,
            family: g.DBParameterGroupFamily ?? "",
            description: g.Description,
            tags: {},
        }))))),
        diff: Effect.fn(function* ({ id, olds, news }) {
            if (!isResolved(news))
                return;
            if ((yield* toName(id, olds ?? {})) !== (yield* toName(id, news))) {
                return { action: "replace" };
            }
            if (olds?.family !== news.family ||
                olds?.description !== news.description) {
                return { action: "replace" };
            }
        }),
        read: Effect.fn(function* ({ id, olds, output }) {
            const name = output?.dbClusterParameterGroupName ??
                (yield* toName(id, olds ?? { family: "" }));
            const group = yield* readGroup(name);
            if (!group?.DBClusterParameterGroupName) {
                return undefined;
            }
            return {
                dbClusterParameterGroupName: group.DBClusterParameterGroupName,
                dbClusterParameterGroupArn: group.DBClusterParameterGroupArn,
                family: group.DBParameterGroupFamily ?? olds?.family ?? "",
                description: group.Description,
                tags: output?.tags ?? {},
            };
        }),
        reconcile: Effect.fn(function* ({ id, news, output, session }) {
            const name = output?.dbClusterParameterGroupName ?? (yield* toName(id, news));
            const internalTags = yield* createInternalTags(id);
            const desiredTags = { ...internalTags, ...news.tags };
            // Observe — fetch the parameter group's live state.
            let observed = yield* readGroup(name);
            // Ensure — create if missing. Tolerate
            // `DBParameterGroupAlreadyExistsFault` as a race with a peer
            // reconciler by re-reading.
            if (!observed?.DBClusterParameterGroupName) {
                yield* rds
                    .createDBClusterParameterGroup({
                    DBClusterParameterGroupName: name,
                    DBParameterGroupFamily: news.family,
                    Description: news.description ?? `Alchemy parameter group ${name}`,
                    Tags: Object.entries(desiredTags).map(([Key, Value]) => ({
                        Key,
                        Value,
                    })),
                })
                    .pipe(Effect.catchTag("DBParameterGroupAlreadyExistsFault", () => Effect.void));
                observed = yield* readGroup(name);
                if (!observed?.DBClusterParameterGroupName) {
                    return yield* Effect.fail(new Error(`Failed to create DB cluster parameter group '${name}'`));
                }
            }
            const dbClusterParameterGroupArn = observed.DBClusterParameterGroupArn;
            // Sync tags — diff observed (the describe response does not
            // surface tags, so use prior `output.tags` as the baseline) ↔
            // desired.
            const observedTags = output?.tags ?? {};
            const { removed, upsert } = diffTags(observedTags, desiredTags);
            if (upsert.length > 0 && dbClusterParameterGroupArn) {
                yield* rds.addTagsToResource({
                    ResourceName: dbClusterParameterGroupArn,
                    Tags: upsert,
                });
            }
            if (removed.length > 0 && dbClusterParameterGroupArn) {
                yield* rds.removeTagsFromResource({
                    ResourceName: dbClusterParameterGroupArn,
                    TagKeys: removed,
                });
            }
            yield* session.note(dbClusterParameterGroupArn ?? name);
            return {
                dbClusterParameterGroupName: observed.DBClusterParameterGroupName,
                dbClusterParameterGroupArn,
                family: observed.DBParameterGroupFamily ?? news.family,
                description: observed.Description,
                tags: desiredTags,
            };
        }),
        delete: Effect.fn(function* ({ output }) {
            yield* rds
                .deleteDBClusterParameterGroup({
                DBClusterParameterGroupName: output.dbClusterParameterGroupName,
            })
                .pipe(Effect.catchTag("DBParameterGroupNotFoundFault", () => Effect.void));
        }),
    };
}));
//# sourceMappingURL=DBClusterParameterGroup.js.map