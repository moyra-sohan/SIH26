import * as emr from "@distilled.cloud/aws/emr";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schedule from "effect/Schedule";
import * as Stream from "effect/Stream";
import { Unowned } from "../../AdoptPolicy.js";
import { isResolved } from "../../Diff.js";
import { createPhysicalName } from "../../PhysicalName.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
import { createInternalTags, diffTags, hasAlchemyTags } from "../../Tags.js";
import { toWireSeconds } from "../../Util/Duration.js";
/**
 * A provisioned Amazon EMR cluster (job flow) running open-source big-data
 * frameworks such as Apache Spark and Hadoop on EC2 instances.
 *
 * Clusters take roughly 10-15 minutes to reach `WAITING` and bill per
 * instance-hour while they exist. Each cluster needs an EMR service role and
 * an EC2 instance profile (job-flow role); destroy clusters you are not
 * using, or set `autoTerminationPolicy` as a safety net.
 * ### Creating a Cluster
 * **Example:** Spark Cluster in a Default-VPC Subnet
 * ```typescript
 * const cluster = yield* Cluster("Analytics", {
 *   releaseLabel: "emr-7.5.0",
 *   applications: ["Spark", "Hadoop"],
 *   serviceRole: serviceRole.roleName,
 *   jobFlowRole: instanceProfile.instanceProfileName,
 *   logUri: Output.interpolate`s3://${logsBucket.bucketName}/logs/`,
 *   instances: {
 *     masterInstanceType: "m5.xlarge",
 *     coreInstanceType: "m5.xlarge",
 *     coreInstanceCount: 1,
 *     ec2SubnetId: subnetId,
 *   },
 * });
 * ```
 *
 * **Example:** Cluster with an Auto-Termination Safety Net
 * ```typescript
 * const cluster = yield* Cluster("Batch", {
 *   releaseLabel: "emr-7.5.0",
 *   applications: ["Spark"],
 *   serviceRole: serviceRole.roleName,
 *   jobFlowRole: instanceProfile.instanceProfileName,
 *   autoTerminationPolicy: { idleTimeout: "1 hour" },
 *   stepConcurrencyLevel: 4,
 * });
 * ```
 *
 * ### Applying a Security Configuration
 * **Example:** Cluster with Encryption Settings
 * ```typescript
 * const config = yield* SecurityConfiguration("Encryption", {
 *   securityConfiguration: {
 *     EncryptionConfiguration: {
 *       EnableInTransitEncryption: false,
 *       EnableAtRestEncryption: false,
 *     },
 *   },
 * });
 * const cluster = yield* Cluster("Secure", {
 *   releaseLabel: "emr-7.5.0",
 *   serviceRole: serviceRole.roleName,
 *   jobFlowRole: instanceProfile.instanceProfileName,
 *   securityConfiguration: config.securityConfigurationName,
 * });
 * ```
 *
 * @resource
 */
export const Cluster = Resource("AWS.EMR.Cluster");
// States in which a cluster is (still) a live, converging resource.
const ACTIVE_STATES = [
    "STARTING",
    "BOOTSTRAPPING",
    "RUNNING",
    "WAITING",
];
// Terminal states: the cluster is gone or irreversibly going away.
const TERMINAL_STATES = new Set([
    "TERMINATING",
    "TERMINATED",
    "TERMINATED_WITH_ERRORS",
]);
const toTagRecord = (tags) => Object.fromEntries((tags ?? [])
    .filter((tag) => typeof tag.Key === "string" && typeof tag.Value === "string")
    .map((tag) => [tag.Key, tag.Value]));
const sameStringSet = (a, b) => {
    const left = [...(a ?? [])].sort();
    const right = [...(b ?? [])].sort();
    return left.length === right.length && left.every((v, i) => v === right[i]);
};
/** Build the master/core instance-group configuration for RunJobFlow. */
const buildInstanceGroups = (instances) => {
    const coreCount = instances?.coreInstanceCount ?? 1;
    return [
        {
            Name: "Master",
            InstanceRole: "MASTER",
            InstanceType: instances?.masterInstanceType ?? "m5.xlarge",
            InstanceCount: 1,
        },
        ...(coreCount > 0
            ? [
                {
                    Name: "Core",
                    InstanceRole: "CORE",
                    InstanceType: instances?.coreInstanceType ?? "m5.xlarge",
                    InstanceCount: coreCount,
                },
            ]
            : []),
    ];
};
export const ClusterProvider = () => Provider.effect(Cluster, Effect.gen(function* () {
    const toName = (id, props) => props.clusterName
        ? Effect.succeed(props.clusterName)
        : createPhysicalName({ id, maxLength: 80 });
    // Describe a cluster by id; a terminal or missing cluster reads as
    // undefined — a terminated EMR cluster cannot be revived or updated.
    const readCluster = Effect.fn(function* (clusterId) {
        const response = yield* emr
            .describeCluster({ ClusterId: clusterId })
            .pipe(Effect.catchTag("ClusterNotFound", () => Effect.succeed(undefined)));
        const cluster = response?.Cluster;
        if (!cluster?.Id)
            return undefined;
        if (TERMINAL_STATES.has(cluster.Status?.State ?? ""))
            return undefined;
        return cluster;
    });
    // Cluster names are not unique in EMR; the deterministic physical name
    // is. Find the live (non-terminal) cluster carrying our name — used
    // when state was lost and we only know the derived name.
    const findClusterByName = Effect.fn(function* (name) {
        const summary = yield* emr.listClusters
            .items({ ClusterStates: [...ACTIVE_STATES] })
            .pipe(Stream.filter((summary) => summary.Name === name), Stream.runHead, Effect.map(Option.getOrUndefined));
        return summary?.Id ? yield* readCluster(summary.Id) : undefined;
    });
    // Bounded readiness wait. A Spark/Hadoop cluster typically reaches
    // WAITING in 10-15 minutes; budget ~30 min (90 * 20s). A terminal
    // state stops the wait immediately (non-retryable).
    const waitForReady = Effect.fn(function* (clusterId) {
        const policy = Schedule.max([
            Schedule.fixed("20 seconds"),
            Schedule.recurs(90),
        ]);
        return yield* emr.describeCluster({ ClusterId: clusterId }).pipe(Effect.flatMap((response) => {
            const cluster = response.Cluster;
            const state = cluster?.Status?.State ?? "STARTING";
            if (TERMINAL_STATES.has(state)) {
                const reason = cluster?.Status?.StateChangeReason;
                return Effect.fail(new Error(`EMR cluster '${clusterId}' reached terminal state '${state}'` +
                    ` (${reason?.Code ?? "unknown"}: ${reason?.Message ?? "no message"})`));
            }
            if (state !== "WAITING" && state !== "RUNNING") {
                return Effect.fail(new Error(`EMR cluster '${clusterId}' not ready (state: ${state})`));
            }
            return Effect.succeed(cluster);
        }), Effect.retry({
            while: (e) => e instanceof Error && !e.message.includes("terminal state"),
            schedule: policy,
        }));
    });
    const toAttrs = Effect.fn(function* (cluster) {
        if (!cluster.Id || !cluster.ClusterArn || !cluster.Name) {
            return yield* Effect.fail(new Error(`EMR cluster '${cluster.Id}' is missing its ARN or name`));
        }
        return {
            clusterId: cluster.Id,
            clusterArn: cluster.ClusterArn,
            clusterName: cluster.Name,
            state: cluster.Status?.State ?? "STARTING",
            masterPublicDnsName: cluster.MasterPublicDnsName,
            tags: toTagRecord(cluster.Tags),
        };
    });
    return {
        stables: ["clusterId", "clusterArn", "clusterName"],
        diff: Effect.fn(function* ({ id, olds, news }) {
            if (!isResolved(news))
                return undefined;
            const n = news;
            const o = olds;
            if (n === undefined || o === undefined)
                return undefined;
            if ((yield* toName(id, o)) !== (yield* toName(id, n))) {
                return { action: "replace" };
            }
            // Create-only cluster-level properties force a replacement.
            if (n.releaseLabel !== o.releaseLabel) {
                return { action: "replace" };
            }
            if (!sameStringSet(n.applications, o.applications)) {
                return { action: "replace" };
            }
            if (n.serviceRole !== o.serviceRole) {
                return { action: "replace" };
            }
            if (n.jobFlowRole !== o.jobFlowRole) {
                return { action: "replace" };
            }
            if ((n.logUri ?? undefined) !== (o.logUri ?? undefined)) {
                return { action: "replace" };
            }
            if ((n.securityConfiguration ?? undefined) !==
                (o.securityConfiguration ?? undefined)) {
                return { action: "replace" };
            }
            if (JSON.stringify(n.configurations ?? []) !==
                JSON.stringify(o.configurations ?? [])) {
                return { action: "replace" };
            }
            if ((n.ebsRootVolumeSize ?? undefined) !==
                (o.ebsRootVolumeSize ?? undefined)) {
                return { action: "replace" };
            }
            if ((n.customAmiId ?? undefined) !== (o.customAmiId ?? undefined)) {
                return { action: "replace" };
            }
            // Create-only instance topology.
            const ni = n.instances ?? {};
            const oi = o.instances ?? {};
            if ((ni.masterInstanceType ?? "m5.xlarge") !==
                (oi.masterInstanceType ?? "m5.xlarge") ||
                (ni.coreInstanceType ?? "m5.xlarge") !==
                    (oi.coreInstanceType ?? "m5.xlarge") ||
                (ni.ec2SubnetId ?? undefined) !== (oi.ec2SubnetId ?? undefined) ||
                (ni.ec2KeyName ?? undefined) !== (oi.ec2KeyName ?? undefined) ||
                (ni.emrManagedMasterSecurityGroup ?? undefined) !==
                    (oi.emrManagedMasterSecurityGroup ?? undefined) ||
                (ni.emrManagedSlaveSecurityGroup ?? undefined) !==
                    (oi.emrManagedSlaveSecurityGroup ?? undefined) ||
                !sameStringSet(ni.additionalMasterSecurityGroups, oi.additionalMasterSecurityGroups) ||
                !sameStringSet(ni.additionalSlaveSecurityGroups, oi.additionalSlaveSecurityGroups)) {
                return { action: "replace" };
            }
            // The core group can resize in place, but crossing the 0 boundary
            // adds/removes the whole group — replacement.
            const newCore = ni.coreInstanceCount ?? 1;
            const oldCore = oi.coreInstanceCount ?? 1;
            if ((newCore === 0) !== (oldCore === 0)) {
                return { action: "replace" };
            }
        }),
        read: Effect.fn(function* ({ id, olds, output }) {
            const cluster = output?.clusterId
                ? yield* readCluster(output.clusterId)
                : yield* findClusterByName(yield* toName(id, olds ?? {}));
            if (!cluster)
                return undefined;
            const attrs = yield* toAttrs(cluster);
            return (yield* hasAlchemyTags(id, attrs.tags))
                ? attrs
                : Unowned(attrs);
        }),
        reconcile: Effect.fn(function* ({ id, news, output, session }) {
            const props = news;
            const name = output?.clusterName ?? (yield* toName(id, props));
            const internalTags = yield* createInternalTags(id);
            const desiredTags = { ...internalTags, ...props.tags };
            // 1. Observe — cloud state is authoritative; output is only an id
            //    cache. A terminated cluster reads as missing.
            let observed = output?.clusterId
                ? yield* readCluster(output.clusterId)
                : yield* findClusterByName(name);
            // 2. Ensure — launch the job flow if missing. Create errors
            //    (invalid roles, subnet, release) propagate directly.
            let clusterId = observed?.Id;
            if (clusterId === undefined) {
                const instances = props.instances ?? {};
                const created = yield* emr.runJobFlow({
                    Name: name,
                    ReleaseLabel: props.releaseLabel,
                    Applications: (props.applications ?? []).map((Name) => ({
                        Name,
                    })),
                    Instances: {
                        InstanceGroups: buildInstanceGroups(props.instances),
                        Ec2SubnetId: instances.ec2SubnetId,
                        Ec2KeyName: instances.ec2KeyName,
                        KeepJobFlowAliveWhenNoSteps: instances.keepJobFlowAliveWhenNoSteps ?? true,
                        TerminationProtected: instances.terminationProtected ?? false,
                        UnhealthyNodeReplacement: instances.unhealthyNodeReplacement,
                        EmrManagedMasterSecurityGroup: instances.emrManagedMasterSecurityGroup,
                        EmrManagedSlaveSecurityGroup: instances.emrManagedSlaveSecurityGroup,
                        AdditionalMasterSecurityGroups: instances.additionalMasterSecurityGroups,
                        AdditionalSlaveSecurityGroups: instances.additionalSlaveSecurityGroups,
                    },
                    ServiceRole: props.serviceRole,
                    JobFlowRole: props.jobFlowRole,
                    LogUri: props.logUri,
                    SecurityConfiguration: props.securityConfiguration,
                    Configurations: props.configurations,
                    VisibleToAllUsers: props.visibleToAllUsers ?? true,
                    EbsRootVolumeSize: props.ebsRootVolumeSize,
                    CustomAmiId: props.customAmiId,
                    StepConcurrencyLevel: props.stepConcurrencyLevel,
                    AutoTerminationPolicy: props.autoTerminationPolicy
                        ? {
                            IdleTimeout: toWireSeconds(props.autoTerminationPolicy.idleTimeout),
                        }
                        : undefined,
                    Tags: Object.entries(desiredTags).map(([Key, Value]) => ({
                        Key,
                        Value,
                    })),
                });
                if (!created.JobFlowId) {
                    return yield* Effect.fail(new Error(`RunJobFlow for '${name}' returned no JobFlowId`));
                }
                clusterId = created.JobFlowId;
            }
            // Provisioning surfaces as STARTING/BOOTSTRAPPING; wait (bounded)
            // for WAITING/RUNNING so modify calls don't race bootstrap.
            observed = yield* waitForReady(clusterId);
            // 3. Sync — per mutable aspect, diff OBSERVED state against the
            //    desired props and apply only the delta.
            const desiredVisible = props.visibleToAllUsers ?? true;
            if ((observed.VisibleToAllUsers ?? true) !== desiredVisible) {
                yield* emr.setVisibleToAllUsers({
                    JobFlowIds: [clusterId],
                    VisibleToAllUsers: desiredVisible,
                });
            }
            const desiredKeepAlive = props.instances?.keepJobFlowAliveWhenNoSteps ?? true;
            const observedKeepAlive = !(observed.AutoTerminate ?? false);
            if (observedKeepAlive !== desiredKeepAlive) {
                yield* emr.setKeepJobFlowAliveWhenNoSteps({
                    JobFlowIds: [clusterId],
                    KeepJobFlowAliveWhenNoSteps: desiredKeepAlive,
                });
            }
            const desiredProtected = props.instances?.terminationProtected;
            if (desiredProtected !== undefined &&
                (observed.TerminationProtected ?? false) !== desiredProtected) {
                yield* emr.setTerminationProtection({
                    JobFlowIds: [clusterId],
                    TerminationProtected: desiredProtected,
                });
            }
            const desiredUnhealthy = props.instances?.unhealthyNodeReplacement;
            if (desiredUnhealthy !== undefined &&
                (observed.UnhealthyNodeReplacement ?? false) !== desiredUnhealthy) {
                yield* emr.setUnhealthyNodeReplacement({
                    JobFlowIds: [clusterId],
                    UnhealthyNodeReplacement: desiredUnhealthy,
                });
            }
            if (props.stepConcurrencyLevel !== undefined &&
                (observed.StepConcurrencyLevel ?? 1) !== props.stepConcurrencyLevel) {
                yield* emr.modifyCluster({
                    ClusterId: clusterId,
                    StepConcurrencyLevel: props.stepConcurrencyLevel,
                });
            }
            // Auto-termination policy: observe, then put/remove the delta.
            const observedPolicy = yield* emr
                .getAutoTerminationPolicy({ ClusterId: clusterId })
                .pipe(Effect.map((r) => r.AutoTerminationPolicy), Effect.catch(() => Effect.succeed(undefined)));
            if (props.autoTerminationPolicy !== undefined) {
                const desiredIdleTimeout = toWireSeconds(props.autoTerminationPolicy.idleTimeout);
                if (observedPolicy?.IdleTimeout !== desiredIdleTimeout) {
                    yield* emr.putAutoTerminationPolicy({
                        ClusterId: clusterId,
                        AutoTerminationPolicy: {
                            IdleTimeout: desiredIdleTimeout,
                        },
                    });
                }
            }
            else if (observedPolicy !== undefined) {
                yield* emr.removeAutoTerminationPolicy({ ClusterId: clusterId });
            }
            // Core instance-group resize (in place between non-zero counts).
            const desiredCore = props.instances?.coreInstanceCount ?? 1;
            if (desiredCore > 0) {
                const core = yield* emr.listInstanceGroups
                    .items({ ClusterId: clusterId })
                    .pipe(Stream.filter((g) => g.InstanceGroupType === "CORE"), Stream.runHead, Effect.map(Option.getOrUndefined));
                if (core?.Id !== undefined &&
                    (core.RequestedInstanceCount ?? 0) !== desiredCore) {
                    yield* emr.modifyInstanceGroups({
                        ClusterId: clusterId,
                        InstanceGroups: [
                            { InstanceGroupId: core.Id, InstanceCount: desiredCore },
                        ],
                    });
                }
            }
            // 3b. Sync tags — diff against OBSERVED cloud tags.
            const observedTags = toTagRecord(observed.Tags);
            const { removed, upsert } = diffTags(observedTags, desiredTags);
            if (upsert.length > 0) {
                yield* emr.addTags({ ResourceId: clusterId, Tags: upsert });
            }
            if (removed.length > 0) {
                yield* emr.removeTags({ ResourceId: clusterId, TagKeys: removed });
            }
            // 4. Return fresh attributes.
            const final = yield* readCluster(clusterId);
            yield* session.note(clusterId);
            return yield* toAttrs(final ?? observed);
        }),
        delete: Effect.fn(function* ({ output }) {
            const clusterId = output.clusterId;
            // A cluster that is already terminal (or gone) is success.
            const observed = yield* readCluster(clusterId);
            if (observed === undefined)
                return;
            // Lift termination protection so TerminateJobFlows succeeds.
            if (observed.TerminationProtected === true) {
                yield* emr
                    .setTerminationProtection({
                    JobFlowIds: [clusterId],
                    TerminationProtected: false,
                })
                    .pipe(Effect.catchTag("JobFlowNotFound", () => Effect.void));
            }
            yield* emr
                .terminateJobFlows({ JobFlowIds: [clusterId] })
                .pipe(Effect.catchTag("JobFlowNotFound", () => Effect.void));
            // Termination is irreversible once initiated; wait (bounded) for
            // the state to leave the active set. Full instance teardown takes
            // 5-10 more minutes server-side and needs no babysitting.
            yield* emr.describeCluster({ ClusterId: clusterId }).pipe(Effect.flatMap((response) => {
                const state = response.Cluster?.Status?.State ?? "TERMINATED";
                return TERMINAL_STATES.has(state)
                    ? Effect.void
                    : Effect.fail(new Error(`EMR cluster '${clusterId}' still active (state: ${state})`));
            }), Effect.catchTag("ClusterNotFound", () => Effect.void), Effect.retry({
                schedule: Schedule.max([
                    Schedule.fixed("10 seconds"),
                    Schedule.recurs(30),
                ]),
            }));
        }),
        list: () => emr.listClusters.items({ ClusterStates: [...ACTIVE_STATES] }).pipe(Stream.runCollect, Effect.map((chunk) => Array.from(chunk).flatMap((summary) => summary.Id ? [summary.Id] : [])), Effect.flatMap(Effect.forEach((clusterId) => readCluster(clusterId), {
            concurrency: 4,
        })), Effect.map((clusters) => clusters.flatMap((cluster) => cluster === undefined ? [] : [cluster])), Effect.flatMap(Effect.forEach((cluster) => toAttrs(cluster), {
            concurrency: 4,
        }))),
    };
}));
//# sourceMappingURL=Cluster.js.map