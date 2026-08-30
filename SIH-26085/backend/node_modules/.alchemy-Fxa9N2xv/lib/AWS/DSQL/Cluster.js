import * as dsql from "@distilled.cloud/aws/dsql";
import * as Effect from "effect/Effect";
import * as Schedule from "effect/Schedule";
import * as Stream from "effect/Stream";
import { Unowned } from "../../AdoptPolicy.js";
import { isResolved } from "../../Diff.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
import { createInternalTags, diffTags, hasAlchemyTags } from "../../Tags.js";
import { AWSEnvironment } from "../Environment.js";
/**
 * An Amazon Aurora DSQL cluster — a serverless, distributed SQL database with
 * active-active high availability and Postgres wire compatibility.
 *
 * Clusters are pay-per-use with no provisioned capacity, so they have
 * excellent test economics. Create is asynchronous (`CREATING` -> `ACTIVE`),
 * usually completing in under a minute; the provider waits for `ACTIVE`
 * (bounded) before returning.
 * ### Creating a Cluster
 * **Example:** Basic Cluster
 * ```typescript
 * const cluster = yield* Cluster("AppDb", {});
 * // connect to cluster.endpoint on port 5432 as user "admin"
 * ```
 *
 * **Example:** Cluster with Deletion Protection
 * ```typescript
 * const cluster = yield* Cluster("AppDb", {
 *   deletionProtectionEnabled: true,
 * });
 * ```
 *
 * **Example:** Cluster with a Customer-Managed KMS Key
 * ```typescript
 * const cluster = yield* Cluster("AppDb", {
 *   kmsEncryptionKey: key.keyArn,
 * });
 * ```
 *
 * @resource
 */
export const Cluster = Resource("AWS.DSQL.Cluster");
const activeStatuses = new Set(["ACTIVE", "IDLE"]);
export const ClusterProvider = () => Provider.effect(Cluster, Effect.gen(function* () {
    const endpointFor = (identifier, region) => `${identifier}.dsql.${region}.on.aws`;
    const readCluster = Effect.fn(function* (identifier) {
        return yield* dsql
            .getCluster({ identifier })
            .pipe(Effect.catchTag("ResourceNotFoundException", () => Effect.succeed(undefined)));
    });
    const readTags = Effect.fn(function* (arn) {
        const response = yield* dsql
            .listTagsForResource({ resourceArn: arn })
            .pipe(Effect.catch(() => Effect.succeed(undefined)));
        return Object.fromEntries(Object.entries(response?.tags ?? {}).filter((entry) => typeof entry[1] === "string"));
    });
    // Bounded readiness wait. DSQL clusters usually reach ACTIVE within a
    // minute; budget ~5 min (60 * 5s) so slow provisioning still converges
    // without risking the test wall.
    const waitForActive = Effect.fn(function* (identifier) {
        const policy = Schedule.max([
            Schedule.fixed("5 seconds"),
            Schedule.recurs(60),
        ]);
        return yield* readCluster(identifier).pipe(Effect.flatMap((cluster) => {
            if (cluster === undefined) {
                return Effect.fail(new Error(`DSQL cluster '${identifier}' not found`));
            }
            if (!activeStatuses.has(cluster.status)) {
                return Effect.fail(new Error(`DSQL cluster '${identifier}' not active (status: ${cluster.status})`));
            }
            return Effect.succeed(cluster);
        }), Effect.retry({ schedule: policy }));
    });
    const toAttrs = (cluster, region) => ({
        clusterId: cluster.identifier,
        clusterArn: cluster.arn,
        status: cluster.status,
        endpoint: cluster.endpoint ?? endpointFor(cluster.identifier, region),
        deletionProtectionEnabled: cluster.deletionProtectionEnabled,
    });
    return {
        stables: ["clusterId", "clusterArn", "endpoint"],
        diff: Effect.fn(function* ({ olds = {}, news }) {
            if (!isResolved(news))
                return undefined;
            // KMS key is create-only; changing it forces a replacement.
            if ((news.kmsEncryptionKey ?? undefined) !==
                (olds.kmsEncryptionKey ?? undefined)) {
                return { action: "replace" };
            }
        }),
        read: Effect.fn(function* ({ id, output }) {
            if (output?.clusterId === undefined)
                return undefined;
            const { region } = yield* AWSEnvironment.current;
            const cluster = yield* readCluster(output.clusterId);
            if (cluster === undefined || cluster.status === "DELETED") {
                return undefined;
            }
            const tags = yield* readTags(cluster.arn);
            const attrs = toAttrs(cluster, region);
            return (yield* hasAlchemyTags(id, tags)) ? attrs : Unowned(attrs);
        }),
        reconcile: Effect.fn(function* ({ id, news = {}, output, session }) {
            const { region } = yield* AWSEnvironment.current;
            const internalTags = yield* createInternalTags(id);
            const desiredTags = { ...internalTags, ...news.tags };
            // 1. Observe — cloud state is authoritative; output caches the id.
            let observed = output?.clusterId === undefined
                ? undefined
                : yield* readCluster(output.clusterId);
            // 2. Ensure — create if missing. DSQL assigns the identifier.
            let identifier = observed?.identifier ?? output?.clusterId;
            if (observed === undefined) {
                const created = yield* dsql.createCluster({
                    deletionProtectionEnabled: news.deletionProtectionEnabled ?? false,
                    kmsEncryptionKey: news.kmsEncryptionKey,
                    tags: desiredTags,
                });
                identifier = created.identifier;
            }
            // Wait for ACTIVE so subsequent syncs do not hit ConflictException.
            const active = yield* waitForActive(identifier);
            observed = active;
            // 3. Sync deletion protection against observed state.
            if (news.deletionProtectionEnabled !== undefined &&
                news.deletionProtectionEnabled !==
                    observed.deletionProtectionEnabled) {
                yield* dsql.updateCluster({
                    identifier: identifier,
                    deletionProtectionEnabled: news.deletionProtectionEnabled,
                });
                observed = yield* waitForActive(identifier);
            }
            // 3b. Sync tags — diff against OBSERVED cloud tags.
            const observedTags = yield* readTags(observed.arn);
            const { upsert, removed } = diffTags(observedTags, desiredTags);
            if (upsert.length > 0) {
                yield* dsql.tagResource({
                    resourceArn: observed.arn,
                    tags: Object.fromEntries(upsert.map((t) => [t.Key, t.Value])),
                });
            }
            if (removed.length > 0) {
                yield* dsql.untagResource({
                    resourceArn: observed.arn,
                    tagKeys: removed,
                });
            }
            yield* session.note(identifier);
            return toAttrs(observed, region);
        }),
        delete: Effect.fn(function* ({ output }) {
            const identifier = output.clusterId;
            const existing = yield* readCluster(identifier);
            if (existing === undefined)
                return;
            // Deletion protection blocks delete — disable it first.
            if (existing.deletionProtectionEnabled) {
                yield* dsql
                    .updateCluster({
                    identifier,
                    deletionProtectionEnabled: false,
                })
                    .pipe(Effect.catchTag("ResourceNotFoundException", () => Effect.void));
            }
            yield* dsql.deleteCluster({ identifier }).pipe(Effect.catchTag("ResourceNotFoundException", () => Effect.void), 
            // A cluster still CREATING rejects delete with ConflictException;
            // retry briefly until it settles into a deletable state.
            Effect.retry({
                while: (e) => e._tag === "ConflictException",
                schedule: Schedule.max([
                    Schedule.fixed("5 seconds"),
                    Schedule.recurs(24),
                ]),
            }));
        }),
        list: () => Effect.gen(function* () {
            const { region } = yield* AWSEnvironment.current;
            const summaries = yield* dsql.listClusters.items({}).pipe(Stream.runCollect, Effect.map((c) => Array.from(c)));
            return yield* Effect.forEach(summaries, (summary) => readCluster(summary.identifier).pipe(Effect.map((cluster) => cluster === undefined || cluster.status === "DELETED"
                ? undefined
                : toAttrs(cluster, region))), { concurrency: 4 }).pipe(Effect.map((attrs) => attrs.filter((a) => a !== undefined)));
        }),
    };
}));
//# sourceMappingURL=Cluster.js.map