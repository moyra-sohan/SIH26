import * as ga from "@distilled.cloud/aws/global-accelerator";
import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";
import { Unowned } from "../../AdoptPolicy.js";
import { isResolved } from "../../Diff.js";
import { createPhysicalName } from "../../PhysicalName.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
import { createInternalTags, diffTags, hasAlchemyTags } from "../../Tags.js";
import { retryGaDeletion, retryGaTransaction, retryUntilAcceleratorDeletable, retryUntilListenerDeletable, withGaRegion, } from "./common.js";
/**
 * An AWS Global Accelerator standard accelerator — two anycast static IP
 * addresses that route client traffic over the AWS global network to the
 * closest healthy regional endpoint.
 *
 * Accelerators are global resources (the control-plane API lives in
 * us-west-2 regardless of your deployment region — alchemy pins it
 * automatically). Attach `Listener`s to accept traffic and `EndpointGroup`s
 * to route it to ALBs, NLBs, EC2 instances, or Elastic IPs per region.
 * ### Creating Accelerators
 * **Example:** Basic Accelerator
 * ```typescript
 * import * as GlobalAccelerator from "alchemy/AWS/GlobalAccelerator";
 *
 * const accelerator = yield* GlobalAccelerator.Accelerator("Edge");
 * ```
 *
 * **Example:** Dual-Stack Accelerator
 * ```typescript
 * const accelerator = yield* GlobalAccelerator.Accelerator("Edge", {
 *   ipAddressType: "DUAL_STACK",
 * });
 * ```
 *
 * ### Flow Logs
 * **Example:** Publish Flow Logs to S3
 * ```typescript
 * // the bucket policy must grant delivery.logs.amazonaws.com
 * // s3:PutObject + s3:GetBucketAcl
 * const accelerator = yield* GlobalAccelerator.Accelerator("Edge", {
 *   flowLogs: { bucket: logBucket.bucketName, prefix: "ga-flow-logs" },
 * });
 * ```
 *
 * ### Routing Traffic
 * **Example:** Accelerator with Listener and Endpoint Group
 * ```typescript
 * const accelerator = yield* GlobalAccelerator.Accelerator("Edge");
 * const listener = yield* GlobalAccelerator.Listener("Web", {
 *   acceleratorArn: accelerator.acceleratorArn,
 *   portRanges: [{ fromPort: 443, toPort: 443 }],
 *   protocol: "TCP",
 * });
 * yield* GlobalAccelerator.EndpointGroup("UsWest2", {
 *   listenerArn: listener.listenerArn,
 *   endpointGroupRegion: "us-west-2",
 *   endpoints: [{ endpointId: alb.loadBalancerArn }],
 * });
 * ```
 *
 * @resource
 */
export const Accelerator = Resource("AWS.GlobalAccelerator.Accelerator");
const createAcceleratorName = Effect.fn(function* (id, props) {
    return props.name ?? (yield* createPhysicalName({ id, maxLength: 64 }));
});
const toAttributes = (a, acceleratorArn, flowLogs) => ({
    acceleratorArn,
    name: a.Name ?? "",
    dnsName: a.DnsName,
    dualStackDnsName: a.DualStackDnsName,
    ipAddresses: a.IpSets?.flatMap((set) => set.IpAddresses ?? []) ?? [],
    ipAddressType: a.IpAddressType ?? "IPV4",
    enabled: a.Enabled ?? true,
    status: a.Status ?? "IN_PROGRESS",
    flowLogsEnabled: flowLogs?.FlowLogsEnabled ?? false,
    flowLogsS3Bucket: flowLogs?.FlowLogsS3Bucket,
    flowLogsS3Prefix: flowLogs?.FlowLogsS3Prefix,
});
const describeAccelerator = Effect.fn(function* (acceleratorArn) {
    return yield* withGaRegion(ga.describeAccelerator({ AcceleratorArn: acceleratorArn })).pipe(Effect.map((r) => r.Accelerator), Effect.catchTag("AcceleratorNotFoundException", () => Effect.succeed(undefined)));
});
const describeFlowLogs = Effect.fn(function* (acceleratorArn) {
    return yield* withGaRegion(ga.describeAcceleratorAttributes({ AcceleratorArn: acceleratorArn })).pipe(Effect.map((r) => r.AcceleratorAttributes), Effect.catchTag("AcceleratorNotFoundException", () => Effect.succeed(undefined)));
});
const findAcceleratorByName = Effect.fn(function* (name) {
    const accelerators = yield* withGaRegion(ga.listAccelerators.items({}).pipe(Stream.runCollect));
    return Array.from(accelerators).find((a) => a.Name === name);
});
const fetchTags = Effect.fn(function* (resourceArn) {
    return yield* withGaRegion(ga.listTagsForResource({ ResourceArn: resourceArn })).pipe(Effect.map((r) => Object.fromEntries((r.Tags ?? []).map((t) => [t.Key, t.Value]))), Effect.catch(() => Effect.succeed({})));
});
/**
 * Global Accelerator's listener and endpoint-group resources are untagged
 * children and cannot be enumerated independently by account-wide nuke.
 * When nuke explicitly force-deletes an accelerator, discover and remove the
 * complete child tree first. Normal stack destroy still relies on dependency
 * ordering and deletes each child through its own provider.
 */
const deleteAcceleratorChildren = Effect.fn(function* (acceleratorArn) {
    const listeners = yield* withGaRegion(ga.listListeners
        .items({ AcceleratorArn: acceleratorArn })
        .pipe(Stream.runCollect)).pipe(Effect.map((chunk) => Array.from(chunk)), Effect.catchTag("AcceleratorNotFoundException", () => Effect.succeed([])));
    // GA serializes mutations per accelerator. Keep this traversal sequential
    // so deleting several children does not manufacture transaction conflicts.
    yield* Effect.forEach(listeners, Effect.fn(function* (listener) {
        if (!listener.ListenerArn)
            return;
        const listenerArn = listener.ListenerArn;
        const endpointGroups = yield* withGaRegion(ga.listEndpointGroups
            .items({ ListenerArn: listenerArn })
            .pipe(Stream.runCollect)).pipe(Effect.map((chunk) => Array.from(chunk)), Effect.catchTag("ListenerNotFoundException", () => Effect.succeed([])));
        yield* Effect.forEach(endpointGroups, (group) => group.EndpointGroupArn
            ? retryGaDeletion(withGaRegion(ga.deleteEndpointGroup({
                EndpointGroupArn: group.EndpointGroupArn,
            }))).pipe(Effect.catchTag("EndpointGroupNotFoundException", () => Effect.void))
            : Effect.void, { discard: true });
        // Endpoint-group detachment is asynchronous. The same bounded retry
        // used by the child provider waits until the listener is deletable.
        yield* retryUntilListenerDeletable(withGaRegion(ga.deleteListener({ ListenerArn: listenerArn }))).pipe(Effect.catchTag("ListenerNotFoundException", () => Effect.void));
    }), { discard: true });
});
export const AcceleratorProvider = () => Provider.succeed(Accelerator, {
    stables: ["acceleratorArn", "dnsName", "dualStackDnsName", "ipAddresses"],
    // Top-level, account-scoped collection: enumerate every accelerator.
    list: () => withGaRegion(ga.listAccelerators.items({}).pipe(Stream.runCollect, Effect.map((chunk) => Array.from(chunk)
        .filter((a) => a.AcceleratorArn !== undefined)
        .map((a) => toAttributes(a, a.AcceleratorArn))))),
    read: Effect.fn(function* ({ id, olds, output }) {
        let live = output?.acceleratorArn
            ? yield* describeAccelerator(output.acceleratorArn)
            : undefined;
        if (!live?.AcceleratorArn) {
            // No cached ARN (or it vanished) — fall back to the deterministic
            // physical name to recover from lost state / support adoption.
            const name = yield* createAcceleratorName(id, olds ?? {});
            live = yield* findAcceleratorByName(name);
        }
        if (!live?.AcceleratorArn)
            return undefined;
        const flowLogs = yield* describeFlowLogs(live.AcceleratorArn);
        const attrs = toAttributes(live, live.AcceleratorArn, flowLogs);
        const tags = yield* fetchTags(live.AcceleratorArn);
        return (yield* hasAlchemyTags(id, tags)) ? attrs : Unowned(attrs);
    }),
    diff: Effect.fn(function* ({ id, news, olds }) {
        if (!isResolved(news))
            return undefined;
        // Static BYOIP addresses are the accelerator's identity — changing
        // them requires a replacement. Name, ipAddressType, and enabled are
        // all mutable via updateAccelerator.
        if (JSON.stringify(news.ipAddresses ?? []) !==
            JSON.stringify(olds.ipAddresses ?? [])) {
            return { action: "replace" };
        }
        const oldName = yield* createAcceleratorName(id, olds);
        const newName = yield* createAcceleratorName(id, news);
        if (oldName !== newName) {
            // Renames are applied in place by reconcile.
            return undefined;
        }
    }),
    reconcile: Effect.fn(function* ({ id, news, output, instanceId, session }) {
        const name = yield* createAcceleratorName(id, news);
        const internalTags = yield* createInternalTags(id);
        const desiredTags = {
            ...news.tags,
            ...internalTags,
        };
        const desiredEnabled = news.enabled ?? true;
        // Observe — cached ARN first, deterministic name as fallback (covers
        // create-then-persist-failure and adoption).
        let live = output?.acceleratorArn
            ? yield* describeAccelerator(output.acceleratorArn)
            : undefined;
        if (!live?.AcceleratorArn) {
            live = yield* findAcceleratorByName(output?.name ?? name);
        }
        // Ensure — create if missing. The idempotency token (derived from the
        // instance id) makes a crashed-and-retried create safe.
        if (!live?.AcceleratorArn) {
            live = yield* retryGaTransaction(withGaRegion(ga.createAccelerator({
                Name: name,
                IpAddressType: news.ipAddressType,
                IpAddresses: news.ipAddresses,
                Enabled: desiredEnabled,
                IdempotencyToken: instanceId,
                Tags: Object.entries(desiredTags).map(([Key, Value]) => ({
                    Key,
                    Value,
                })),
            }))).pipe(Effect.map((r) => r.Accelerator));
        }
        if (!live?.AcceleratorArn) {
            return yield* Effect.die(new Error("CreateAccelerator returned no accelerator"));
        }
        const acceleratorArn = live.AcceleratorArn;
        // Sync settings — diff observed vs desired, apply only the delta.
        const update = {
            AcceleratorArn: acceleratorArn,
        };
        let dirty = false;
        if ((live.Name ?? "") !== name) {
            update.Name = name;
            dirty = true;
        }
        if (news.ipAddressType !== undefined &&
            live.IpAddressType !== news.ipAddressType) {
            update.IpAddressType = news.ipAddressType;
            dirty = true;
        }
        if ((live.Enabled ?? true) !== desiredEnabled) {
            update.Enabled = desiredEnabled;
            dirty = true;
        }
        if (dirty) {
            const updated = yield* retryGaTransaction(withGaRegion(ga.updateAccelerator(update))).pipe(Effect.map((r) => r.Accelerator));
            if (updated)
                live = updated;
        }
        // Sync flow logs — diff observed attributes against the desired
        // flowLogs prop; only call updateAcceleratorAttributes on drift.
        let flowLogs = yield* describeFlowLogs(acceleratorArn);
        const desiredFlowLogsEnabled = news.flowLogs !== undefined;
        const flowLogsDrift = (flowLogs?.FlowLogsEnabled ?? false) !== desiredFlowLogsEnabled ||
            (desiredFlowLogsEnabled &&
                (flowLogs?.FlowLogsS3Bucket !== news.flowLogs.bucket ||
                    (news.flowLogs.prefix !== undefined &&
                        flowLogs?.FlowLogsS3Prefix !== news.flowLogs.prefix)));
        if (flowLogsDrift) {
            flowLogs = yield* retryGaTransaction(withGaRegion(ga.updateAcceleratorAttributes({
                AcceleratorArn: acceleratorArn,
                FlowLogsEnabled: desiredFlowLogsEnabled,
                ...(desiredFlowLogsEnabled
                    ? {
                        FlowLogsS3Bucket: news.flowLogs.bucket,
                        FlowLogsS3Prefix: news.flowLogs.prefix,
                    }
                    : {}),
            }))).pipe(Effect.map((r) => r.AcceleratorAttributes));
        }
        // Sync tags against OBSERVED cloud tags so adoption converges.
        const observedTags = yield* fetchTags(acceleratorArn);
        const { upsert, removed } = diffTags(observedTags, desiredTags);
        if (upsert.length > 0) {
            yield* withGaRegion(ga.tagResource({ ResourceArn: acceleratorArn, Tags: upsert }));
        }
        if (removed.length > 0) {
            yield* withGaRegion(ga.untagResource({ ResourceArn: acceleratorArn, TagKeys: removed }));
        }
        yield* session.note(acceleratorArn);
        return toAttributes(live, acceleratorArn, flowLogs);
    }),
    delete: Effect.fn(function* ({ output, session, force }) {
        const acceleratorArn = output.acceleratorArn;
        if (force) {
            yield* session.note("deleting accelerator listeners and endpoint groups");
            yield* deleteAcceleratorChildren(acceleratorArn);
        }
        // An accelerator must be disabled before it can be deleted.
        const exists = yield* retryGaTransaction(withGaRegion(ga.updateAccelerator({
            AcceleratorArn: acceleratorArn,
            Enabled: false,
        }))).pipe(Effect.map(() => true), Effect.catchTag("AcceleratorNotFoundException", () => Effect.succeed(false)));
        if (!exists)
            return;
        yield* session.note("waiting for accelerator to disable");
        // The disable propagates asynchronously; deleteAccelerator rejects with
        // AcceleratorNotDisabledException until it lands, so retry bounded.
        yield* retryUntilAcceleratorDeletable(withGaRegion(ga.deleteAccelerator({ AcceleratorArn: acceleratorArn }))).pipe(Effect.catchTag("AcceleratorNotFoundException", () => Effect.void));
    }),
});
//# sourceMappingURL=Accelerator.js.map