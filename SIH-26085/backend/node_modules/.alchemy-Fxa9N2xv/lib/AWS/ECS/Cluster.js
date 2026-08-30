import * as ecs from "@distilled.cloud/aws/ecs";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Schedule from "effect/Schedule";
import * as Stream from "effect/Stream";
import { isResolved } from "../../Diff.js";
import { createPhysicalName } from "../../PhysicalName.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
import { createInternalTags, diffTags } from "../../Tags.js";
import { AWSEnvironment } from "../Environment.js";
/**
 * An Amazon ECS cluster for running tasks and services.
 * ### Creating Clusters
 * **Example:** Default Cluster
 * ```typescript
 * const cluster = yield* Cluster("AppCluster", {});
 * ```
 *
 * @resource
 */
export const Cluster = Resource("AWS.ECS.Cluster");
class ClusterStillActive extends Data.TaggedError("ClusterStillActive") {
}
export const ClusterProvider = () => Provider.effect(Cluster, Effect.gen(function* () {
    const toEcsTags = (tags) => Object.entries(tags).map(([key, value]) => ({
        key,
        value,
    }));
    const toClusterName = (id, props = {}) => props.clusterName
        ? Effect.succeed(props.clusterName)
        : createPhysicalName({ id, maxLength: 255, lowercase: true });
    const applyCapacityProviders = Effect.fn(function* ({ cluster, capacityProviders, defaultCapacityProviderStrategy, }) {
        if (capacityProviders !== undefined ||
            defaultCapacityProviderStrategy !== undefined) {
            yield* ecs.putClusterCapacityProviders({
                cluster,
                capacityProviders: capacityProviders ?? [],
                defaultCapacityProviderStrategy: defaultCapacityProviderStrategy ?? [],
            });
        }
    });
    return {
        stables: ["clusterArn", "clusterName"],
        diff: Effect.fn(function* ({ id, olds, news }) {
            if (!isResolved(news))
                return;
            if ((yield* toClusterName(id, olds ?? {})) !==
                (yield* toClusterName(id, news ?? {}))) {
                return { action: "replace" };
            }
        }),
        read: Effect.fn(function* ({ id, olds, output }) {
            const clusterName = output?.clusterName ?? (yield* toClusterName(id, olds ?? {}));
            const described = yield* ecs.describeClusters({
                clusters: [output?.clusterArn ?? clusterName],
                include: ["SETTINGS", "TAGS", "CONFIGURATIONS"],
            });
            const cluster = described.clusters?.[0];
            // ECS deletion is a transition to INACTIVE. AWS may continue to
            // return an inactive cluster from DescribeClusters for a while, but
            // it is no longer a usable resource and must not be resurrected in
            // state during refresh.
            if (!cluster?.clusterArn || cluster.status === "INACTIVE") {
                return undefined;
            }
            return {
                clusterArn: cluster.clusterArn,
                clusterName: cluster.clusterName,
                status: cluster.status ?? "ACTIVE",
                settings: cluster.settings ?? [],
                configuration: cluster.configuration,
                capacityProviders: cluster.capacityProviders ?? [],
                defaultCapacityProviderStrategy: cluster.defaultCapacityProviderStrategy ?? [],
                serviceConnectDefaults: cluster.serviceConnectDefaults?.namespace
                    ? { namespace: cluster.serviceConnectDefaults.namespace }
                    : undefined,
                tags: output?.tags ?? {},
            };
        }),
        list: () => Effect.gen(function* () {
            // Enumerate every cluster ARN in the account/region, paginating
            // listClusters exhaustively.
            const arns = yield* ecs.listClusters.pages({}).pipe(Stream.runCollect, Effect.map((chunk) => Array.from(chunk).flatMap((page) => page.clusterArns ?? [])));
            if (arns.length === 0) {
                return [];
            }
            // describeClusters accepts at most 100 clusters per call; batch.
            const batches = [];
            for (let i = 0; i < arns.length; i += 100) {
                batches.push(arns.slice(i, i + 100));
            }
            const described = yield* Effect.forEach(batches, (clusters) => ecs
                .describeClusters({
                clusters,
                include: ["SETTINGS", "TAGS", "CONFIGURATIONS"],
            })
                .pipe(Effect.map((res) => res.clusters ?? [])), { concurrency: 5 });
            return described.flat().flatMap((cluster) => {
                // DeleteCluster does not immediately erase a cluster. Inactive
                // clusters can remain discoverable according to the ECS API,
                // so exclude that terminal state from nuke/provider inventory.
                if (!cluster.clusterArn || cluster.status === "INACTIVE") {
                    return [];
                }
                const tags = Object.fromEntries((cluster.tags ?? [])
                    .filter((t) => typeof t.key === "string" && typeof t.value === "string")
                    .map((t) => [t.key, t.value]));
                return [
                    {
                        clusterArn: cluster.clusterArn,
                        clusterName: cluster.clusterName,
                        status: cluster.status ?? "ACTIVE",
                        settings: cluster.settings ?? [],
                        configuration: cluster.configuration,
                        capacityProviders: cluster.capacityProviders ?? [],
                        defaultCapacityProviderStrategy: cluster.defaultCapacityProviderStrategy ?? [],
                        serviceConnectDefaults: cluster.serviceConnectDefaults
                            ?.namespace
                            ? { namespace: cluster.serviceConnectDefaults.namespace }
                            : undefined,
                        tags,
                    },
                ];
            });
        }),
        reconcile: Effect.fn(function* ({ id, news: rawNews, session }) {
            // Every ClusterProps field is optional, so `Cluster("Id")` (no
            // props object at all) is a legal instantiation — normalize.
            const news = rawNews ?? {};
            const { accountId, region } = yield* AWSEnvironment.current;
            const clusterName = yield* toClusterName(id, news);
            const clusterArn = `arn:aws:ecs:${region}:${accountId}:cluster/${clusterName}`;
            const internalTags = yield* createInternalTags(id);
            const desiredTags = { ...internalTags, ...news.tags };
            // Observe — fetch live cloud state.
            let described = yield* ecs.describeClusters({
                clusters: [clusterArn],
                include: ["SETTINGS", "TAGS", "CONFIGURATIONS"],
            });
            let cluster = described.clusters?.find((c) => c.clusterName === clusterName &&
                (c.status === "ACTIVE" || c.status === "PROVISIONING"));
            // Ensure — create if missing. ECS createCluster is idempotent for
            // identical params and returns the existing cluster on conflict;
            // we always sync below regardless.
            if (!cluster?.clusterArn) {
                const created = yield* ecs.createCluster({
                    clusterName,
                    settings: news.settings,
                    configuration: news.configuration,
                    serviceConnectDefaults: news.serviceConnectDefaults,
                    tags: toEcsTags(desiredTags),
                });
                cluster = created.cluster;
            }
            // Sync cluster config — call updateCluster to converge settings,
            // configuration, and serviceConnectDefaults to desired state.
            yield* ecs.updateCluster({
                cluster: clusterArn,
                settings: news.settings,
                configuration: news.configuration,
                serviceConnectDefaults: news.serviceConnectDefaults,
            });
            // Sync capacity providers — observed ↔ desired.
            yield* applyCapacityProviders({
                cluster: clusterArn,
                capacityProviders: news.capacityProviders,
                defaultCapacityProviderStrategy: news.defaultCapacityProviderStrategy,
            });
            // Sync tags — diff observed cloud tags against desired.
            const observedTags = Object.fromEntries((cluster?.tags ?? [])
                .filter((t) => typeof t.key === "string" && typeof t.value === "string")
                .map((t) => [t.key, t.value]));
            const { removed, upsert } = diffTags(observedTags, desiredTags);
            if (upsert.length > 0) {
                yield* ecs.tagResource({
                    resourceArn: clusterArn,
                    tags: upsert.map((tag) => ({ key: tag.Key, value: tag.Value })),
                });
            }
            if (removed.length > 0) {
                yield* ecs.untagResource({
                    resourceArn: clusterArn,
                    tagKeys: removed,
                });
            }
            yield* session.note(clusterArn);
            return {
                clusterArn,
                clusterName,
                status: cluster?.status ?? "ACTIVE",
                settings: news.settings ?? [],
                configuration: news.configuration,
                capacityProviders: news.capacityProviders ?? [],
                defaultCapacityProviderStrategy: news.defaultCapacityProviderStrategy ?? [],
                serviceConnectDefaults: news.serviceConnectDefaults,
                tags: desiredTags,
            };
        }),
        delete: Effect.fn(function* ({ output }) {
            const cluster = output.clusterArn;
            // Observe mutable associations instead of trusting persisted output:
            // capacity providers can be attached out of band or output can be
            // stale after a prior interrupted reconcile.
            const observedCluster = (yield* ecs.describeClusters({
                clusters: [cluster],
            })).clusters?.find((candidate) => candidate.clusterArn === cluster);
            // A cluster cannot be deleted while it still contains services,
            // running tasks, or registered container instances — empty it
            // first so deletion actually converges instead of silently
            // leaving the cluster behind.
            // 1. Delete services (force skips the scale-to-zero dance).
            const serviceArns = yield* ecs.listServices.pages({ cluster }).pipe(Stream.runCollect, Effect.map((chunk) => Array.from(chunk).flatMap((page) => page.serviceArns ?? [])), Effect.catchTag("ClusterNotFoundException", () => Effect.succeed([])));
            yield* Effect.forEach(serviceArns, (service) => ecs.deleteService({ cluster, service, force: true }).pipe(Effect.catchTag(["ServiceNotFoundException", "ClusterNotFoundException"], () => Effect.succeed(undefined)), Effect.asVoid), { discard: true });
            // 2. Stop any remaining standalone tasks.
            const taskArns = yield* ecs.listTasks.pages({ cluster }).pipe(Stream.runCollect, Effect.map((chunk) => Array.from(chunk).flatMap((page) => page.taskArns ?? [])), Effect.catchTag("ClusterNotFoundException", () => Effect.succeed([])));
            yield* Effect.forEach(taskArns, (task) => ecs.stopTask({ cluster, task, reason: "alchemy delete" }).pipe(Effect.catchTag("ClusterNotFoundException", () => Effect.succeed(undefined)), Effect.asVoid), { discard: true });
            // 3. Deregister container instances (EC2 launch type).
            const instanceArns = yield* ecs.listContainerInstances
                .pages({ cluster })
                .pipe(Stream.runCollect, Effect.map((chunk) => Array.from(chunk).flatMap((page) => page.containerInstanceArns ?? [])), Effect.catchTag("ClusterNotFoundException", () => Effect.succeed([])));
            yield* Effect.forEach(instanceArns, (containerInstance) => ecs
                .deregisterContainerInstance({
                cluster,
                containerInstance,
                force: true,
            })
                .pipe(Effect.catchTag("ClusterNotFoundException", () => Effect.succeed(undefined)), Effect.asVoid), { discard: true });
            // 4. Remove custom capacity-provider associations. A cluster with
            //    an associated provider cannot be deleted even after its
            //    services, tasks, and container instances have drained.
            if ((observedCluster?.capacityProviders ?? output.capacityProviders)
                .length > 0) {
                yield* ecs
                    .putClusterCapacityProviders({
                    cluster,
                    capacityProviders: [],
                    defaultCapacityProviderStrategy: [],
                })
                    .pipe(Effect.retry({
                    while: (e) => e._tag === "UpdateInProgressException" ||
                        e._tag === "ResourceInUseException",
                    schedule: Schedule.max([
                        Schedule.fixed("3 seconds"),
                        Schedule.recurs(10),
                    ]),
                }), Effect.catchTag("ClusterNotFoundException", () => Effect.void));
            }
            // 5. Delete the (now empty) cluster. Draining services/tasks is
            //    asynchronous, so retry the contains-* rejections briefly.
            yield* ecs
                .deleteCluster({
                cluster,
            })
                .pipe(Effect.retry({
                while: (e) => e._tag === "ClusterContainsServicesException" ||
                    e._tag === "ClusterContainsTasksException" ||
                    e._tag === "ClusterContainsContainerInstancesException" ||
                    e._tag === "ClusterContainsCapacityProviderException" ||
                    e._tag === "UpdateInProgressException",
                schedule: Schedule.max([
                    Schedule.fixed("3 seconds"),
                    Schedule.recurs(15),
                ]),
            }), Effect.catchTag("ClusterNotFoundException", () => Effect.void));
            // DeleteCluster's successful response only means that ECS accepted
            // the transition. Observe the terminal INACTIVE state (or absence)
            // before reporting deletion so dependent teardown and a following
            // nuke pass do not race the cluster lifecycle.
            yield* ecs.describeClusters({ clusters: [cluster] }).pipe(Effect.flatMap((response) => {
                const observed = response.clusters?.find((candidate) => candidate.clusterArn === cluster);
                return !observed || observed.status === "INACTIVE"
                    ? Effect.void
                    : Effect.fail(new ClusterStillActive({
                        cluster,
                        status: observed.status,
                    }));
            }), Effect.retry({
                while: (error) => error instanceof ClusterStillActive,
                schedule: Schedule.max([
                    Schedule.fixed("2 seconds"),
                    Schedule.recurs(15),
                ]),
            }));
        }),
    };
}));
//# sourceMappingURL=Cluster.js.map