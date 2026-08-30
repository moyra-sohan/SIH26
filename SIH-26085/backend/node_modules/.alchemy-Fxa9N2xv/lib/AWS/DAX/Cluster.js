import * as dax from "@distilled.cloud/aws/dax";
import * as Effect from "effect/Effect";
import * as Schedule from "effect/Schedule";
import { Unowned } from "../../AdoptPolicy.js";
import { isResolved } from "../../Diff.js";
import { createPhysicalName } from "../../PhysicalName.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
import { createInternalTags, diffTags, hasAlchemyTags } from "../../Tags.js";
import { readDaxTags, sameStringSet } from "./internal.js";
/**
 * An Amazon DAX cluster — a fully managed, in-memory write-through cache for
 * DynamoDB.
 *
 * Clusters are VPC-only and take roughly 5-10 minutes to provision; they are
 * billed per node-hour while they exist. Place them in a {@link SubnetGroup}
 * and give them an IAM role that DAX assumes to reach DynamoDB. Destroy
 * clusters you are not using.
 * ### Creating a Cluster
 * **Example:** Single-Node Development Cluster
 * ```typescript
 * const role = yield* IAM.Role("DaxRole", {
 *   assumeRolePolicyDocument: {
 *     Version: "2012-10-17",
 *     Statement: [{
 *       Effect: "Allow",
 *       Principal: { Service: "dax.amazonaws.com" },
 *       Action: ["sts:AssumeRole"],
 *     }],
 *   },
 *   managedPolicyArns: ["arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess"],
 * });
 * const subnetGroup = yield* SubnetGroup("DaxSubnets", {
 *   subnetIds: [subnetA.subnetId, subnetB.subnetId],
 * });
 * const cluster = yield* Cluster("Cache", {
 *   nodeType: "dax.t3.small",
 *   replicationFactor: 1,
 *   iamRoleArn: role.roleArn,
 *   subnetGroupName: subnetGroup.subnetGroupName,
 * });
 * ```
 *
 * ### Encryption
 * **Example:** Cluster with Encryption At Rest and In Transit
 * ```typescript
 * const cluster = yield* Cluster("SecureCache", {
 *   nodeType: "dax.t3.small",
 *   replicationFactor: 3,
 *   iamRoleArn: role.roleArn,
 *   subnetGroupName: subnetGroup.subnetGroupName,
 *   sseEnabled: true,
 *   clusterEndpointEncryptionType: "TLS",
 * });
 * ```
 *
 * @resource
 */
export const Cluster = Resource("AWS.DAX.Cluster");
const DEFAULT_NODE_TYPE = "dax.t3.small";
const DEFAULT_REPLICATION_FACTOR = 1;
// A freshly created IAM role is not immediately assumable by dax.amazonaws.com
// — CreateCluster rejects with "No permission to assume role" until IAM
// propagates (typically a few seconds). Bounded retry through that window.
const retryIamRolePropagation = (self) => Effect.retry(self, {
    while: (e) => e._tag === "InvalidParameterValueException" &&
        (e.message?.includes("No permission to assume role") ??
            false),
    schedule: Schedule.max([Schedule.fixed("5 seconds"), Schedule.recurs(10)]),
});
export const ClusterProvider = () => Provider.effect(Cluster, Effect.gen(function* () {
    const toName = (id, props) => props.clusterName
        ? Effect.succeed(props.clusterName)
        : createPhysicalName({ id, maxLength: 20, lowercase: true });
    const readCluster = Effect.fn(function* (name) {
        const response = yield* dax
            .describeClusters({ ClusterNames: [name] })
            .pipe(Effect.catchTag("ClusterNotFoundFault", () => Effect.succeed(undefined)));
        return response?.Clusters?.[0];
    });
    // Bounded readiness wait. DAX cluster provisioning/modification
    // typically completes in 5-10 minutes; budget ~15 min (60 * 15s).
    const waitForAvailable = Effect.fn(function* (name) {
        const policy = Schedule.max([
            Schedule.fixed("15 seconds"),
            Schedule.recurs(60),
        ]);
        return yield* readCluster(name).pipe(Effect.flatMap((cluster) => {
            if (!cluster?.ClusterArn) {
                return Effect.fail(new Error(`DAX cluster '${name}' not found`));
            }
            if (cluster.Status !== "available") {
                return Effect.fail(new Error(`DAX cluster '${name}' not available (status: ${cluster.Status})`));
            }
            return Effect.succeed(cluster);
        }), Effect.retry({ schedule: policy }));
    });
    // Wait for a cluster to leave a transitional state before delete. Ends
    // when the cluster is available, deleting, or gone.
    const waitUntilSettled = Effect.fn(function* (name) {
        const policy = Schedule.max([
            Schedule.fixed("15 seconds"),
            Schedule.recurs(60),
        ]);
        return yield* readCluster(name).pipe(Effect.flatMap((cluster) => {
            if (cluster !== undefined &&
                cluster.Status !== "available" &&
                cluster.Status !== "deleting") {
                return Effect.fail(new Error(`DAX cluster '${name}' still settling (status: ${cluster.Status})`));
            }
            return Effect.succeed(cluster);
        }), Effect.retry({ schedule: policy }));
    });
    const toAttrs = Effect.fn(function* (cluster) {
        if (!cluster.ClusterName || !cluster.ClusterArn) {
            return yield* Effect.fail(new Error(`DAX cluster '${cluster.ClusterName}' is missing its ARN`));
        }
        return {
            clusterName: cluster.ClusterName,
            clusterArn: cluster.ClusterArn,
            status: cluster.Status ?? "available",
            nodeType: cluster.NodeType ?? DEFAULT_NODE_TYPE,
            totalNodes: cluster.TotalNodes,
            activeNodes: cluster.ActiveNodes,
            discoveryEndpointAddress: cluster.ClusterDiscoveryEndpoint?.Address,
            discoveryEndpointPort: cluster.ClusterDiscoveryEndpoint?.Port,
            discoveryEndpointUrl: cluster.ClusterDiscoveryEndpoint?.URL,
            subnetGroupName: cluster.SubnetGroup,
            iamRoleArn: cluster.IamRoleArn,
            parameterGroupName: cluster.ParameterGroup?.ParameterGroupName,
            securityGroupIds: (cluster.SecurityGroups ?? [])
                .map((g) => g.SecurityGroupIdentifier)
                .filter((g) => g !== undefined),
            clusterEndpointEncryptionType: cluster.ClusterEndpointEncryptionType,
            tags: yield* readDaxTags(cluster.ClusterArn),
        };
    });
    return {
        stables: ["clusterName", "clusterArn"],
        diff: Effect.fn(function* ({ id, olds, news }) {
            if (!isResolved(news))
                return undefined;
            const n = news ?? { iamRoleArn: "" };
            const o = olds ?? { iamRoleArn: "" };
            if ((yield* toName(id, o)) !== (yield* toName(id, n))) {
                return { action: "replace" };
            }
            // Create-only properties force a replacement.
            if ((n.nodeType ?? DEFAULT_NODE_TYPE) !==
                (o.nodeType ?? DEFAULT_NODE_TYPE)) {
                return { action: "replace" };
            }
            if (n.iamRoleArn !== o.iamRoleArn) {
                return { action: "replace" };
            }
            if (n.subnetGroupName !== undefined &&
                o.subnetGroupName !== undefined &&
                n.subnetGroupName !== o.subnetGroupName) {
                return { action: "replace" };
            }
            if ((n.sseEnabled ?? false) !== (o.sseEnabled ?? false)) {
                return { action: "replace" };
            }
            if ((n.clusterEndpointEncryptionType ?? "NONE") !==
                (o.clusterEndpointEncryptionType ?? "NONE")) {
                return { action: "replace" };
            }
            if ((n.networkType ?? undefined) !== (o.networkType ?? undefined)) {
                return { action: "replace" };
            }
            if (!sameStringSet(n.availabilityZones, o.availabilityZones)) {
                return { action: "replace" };
            }
        }),
        read: Effect.fn(function* ({ id, olds, output }) {
            const name = output?.clusterName ??
                (yield* toName(id, olds ?? { iamRoleArn: "" }));
            const cluster = yield* readCluster(name);
            if (!cluster?.ClusterArn)
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
            const desiredReplicationFactor = props.replicationFactor ?? DEFAULT_REPLICATION_FACTOR;
            // 1. Observe — cloud state is authoritative.
            let observed = yield* readCluster(name);
            // 2. Ensure — create if missing; tolerate AlreadyExists as a race.
            if (observed === undefined) {
                yield* dax
                    .createCluster({
                    ClusterName: name,
                    NodeType: props.nodeType ?? DEFAULT_NODE_TYPE,
                    ReplicationFactor: desiredReplicationFactor,
                    IamRoleArn: props.iamRoleArn,
                    Description: props.description,
                    AvailabilityZones: props.availabilityZones,
                    SubnetGroupName: props.subnetGroupName,
                    SecurityGroupIds: props.securityGroupIds,
                    PreferredMaintenanceWindow: props.preferredMaintenanceWindow,
                    NotificationTopicArn: props.notificationTopicArn,
                    ParameterGroupName: props.parameterGroupName,
                    SSESpecification: props.sseEnabled !== undefined
                        ? { Enabled: props.sseEnabled }
                        : undefined,
                    ClusterEndpointEncryptionType: props.clusterEndpointEncryptionType,
                    NetworkType: props.networkType,
                    Tags: Object.entries(desiredTags).map(([Key, Value]) => ({
                        Key,
                        Value,
                    })),
                })
                    .pipe(retryIamRolePropagation, Effect.catchTag("ClusterAlreadyExistsFault", () => Effect.void));
            }
            // Provisioning and in-flight modifications both surface as a
            // non-available status; wait for availability (bounded) so update
            // calls do not hit InvalidClusterStateFault.
            observed = yield* waitForAvailable(name);
            // 3. Sync — compute the update delta from OBSERVED state.
            const update = { ClusterName: name };
            let mutated = false;
            if (props.description !== undefined &&
                props.description !== observed.Description) {
                update.Description = props.description;
                mutated = true;
            }
            if (props.preferredMaintenanceWindow !== undefined &&
                props.preferredMaintenanceWindow !==
                    observed.PreferredMaintenanceWindow) {
                update.PreferredMaintenanceWindow =
                    props.preferredMaintenanceWindow;
                mutated = true;
            }
            if (props.notificationTopicArn !== undefined &&
                props.notificationTopicArn !==
                    observed.NotificationConfiguration?.TopicArn) {
                update.NotificationTopicArn = props.notificationTopicArn;
                mutated = true;
            }
            if (props.parameterGroupName !== undefined &&
                props.parameterGroupName !==
                    observed.ParameterGroup?.ParameterGroupName) {
                update.ParameterGroupName = props.parameterGroupName;
                mutated = true;
            }
            const observedSg = (observed.SecurityGroups ?? [])
                .map((g) => g.SecurityGroupIdentifier)
                .filter((g) => g !== undefined);
            if (props.securityGroupIds !== undefined &&
                !sameStringSet(props.securityGroupIds, observedSg)) {
                update.SecurityGroupIds = props.securityGroupIds;
                mutated = true;
            }
            if (mutated) {
                yield* dax.updateCluster(update);
                observed = yield* waitForAvailable(name);
            }
            // 3b. Sync replication factor — DAX has dedicated add/remove-node
            // APIs instead of a general update.
            const observedFactor = observed.TotalNodes;
            if (observedFactor !== undefined &&
                observedFactor !== desiredReplicationFactor) {
                if (desiredReplicationFactor > observedFactor) {
                    yield* dax.increaseReplicationFactor({
                        ClusterName: name,
                        NewReplicationFactor: desiredReplicationFactor,
                    });
                }
                else {
                    yield* dax.decreaseReplicationFactor({
                        ClusterName: name,
                        NewReplicationFactor: desiredReplicationFactor,
                    });
                }
                observed = yield* waitForAvailable(name);
            }
            // 3c. Sync tags — diff against OBSERVED cloud tags.
            const arn = observed.ClusterArn;
            if (arn) {
                const observedTags = yield* readDaxTags(arn);
                const { removed, upsert } = diffTags(observedTags, desiredTags);
                if (upsert.length > 0) {
                    yield* dax.tagResource({ ResourceName: arn, Tags: upsert });
                }
                if (removed.length > 0) {
                    yield* dax.untagResource({ ResourceName: arn, TagKeys: removed });
                }
            }
            yield* session.note(name);
            return yield* toAttrs(observed);
        }),
        delete: Effect.fn(function* ({ output }) {
            const name = output.clusterName;
            // A cluster mid-create/modify rejects deletion with
            // InvalidClusterStateFault — wait (bounded) for it to settle
            // first. A cluster already deleting (or gone) is success.
            const settled = yield* waitUntilSettled(name).pipe(Effect.catch(() => Effect.succeed(undefined)));
            if (settled === undefined || settled.Status === "deleting") {
                return;
            }
            yield* dax.deleteCluster({ ClusterName: name }).pipe(Effect.catchTag("ClusterNotFoundFault", () => Effect.void), Effect.retry({
                while: (e) => e._tag === "InvalidClusterStateFault",
                schedule: Schedule.max([
                    Schedule.fixed("15 seconds"),
                    Schedule.recurs(20),
                ]),
            }), 
            // Exhausted retries: the cluster is in a state (e.g. an
            // out-of-band delete already in flight) where deletion is
            // already converging — treat as success like the NotFound case.
            Effect.catchTag("InvalidClusterStateFault", () => Effect.void));
        }),
        list: () => Effect.gen(function* () {
            // Bounded hand-rolled pagination (no distilled paginator).
            const clusters = [];
            let nextToken;
            for (let page = 0; page < 20; page++) {
                const response = yield* dax.describeClusters({
                    NextToken: nextToken,
                });
                clusters.push(...(response.Clusters ?? []));
                nextToken = response.NextToken;
                if (!nextToken)
                    break;
            }
            return yield* Effect.forEach(clusters.filter((cluster) => cluster.ClusterName !== undefined &&
                cluster.ClusterArn !== undefined), (cluster) => toAttrs(cluster), { concurrency: 4 });
        }),
    };
}));
//# sourceMappingURL=Cluster.js.map