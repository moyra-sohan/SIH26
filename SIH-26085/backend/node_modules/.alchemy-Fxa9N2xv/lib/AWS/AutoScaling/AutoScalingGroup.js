import * as autoscaling from "@distilled.cloud/aws/auto-scaling";
import * as Effect from "effect/Effect";
import * as Schedule from "effect/Schedule";
import * as Stream from "effect/Stream";
import { deepEqual, isResolved } from "../../Diff.js";
import { createPhysicalName } from "../../PhysicalName.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
import { toSeconds } from "../../Util/Duration.js";
import { createInternalTags, diffTags } from "../../Tags.js";
/**
 * An EC2 Auto Scaling Group that manages a fleet of instances from a launch
 * template and can register that fleet with one or more load balancer target
 * groups.
 *
 * Pair with {@link ScalingPolicy} for target-tracking scaling,
 * {@link ScheduledAction} for time-based capacity changes, and
 * {@link consumeLifecycleActions} to run a Lambda handler while instances
 * pause during launch/terminate transitions.
 * ### Creating an Auto Scaling Group
 * **Example:** Fleet from a Launch Template
 * ```typescript
 * import { AutoScalingGroup, LaunchTemplate } from "alchemy/AWS/AutoScaling";
 * import { Subnet, Vpc } from "alchemy/AWS/EC2";
 *
 * const vpc = yield* Vpc("Vpc", { cidrBlock: "10.0.0.0/16" });
 * const subnet = yield* Subnet("Subnet", {
 *   vpcId: vpc.vpcId,
 *   cidrBlock: "10.0.1.0/24",
 * });
 *
 * const template = yield* LaunchTemplate("Template", {
 *   imageId: "ami-0abcdef1234567890",
 *   instanceType: "t3.micro",
 * });
 *
 * const group = yield* AutoScalingGroup("Fleet", {
 *   launchTemplate: template,
 *   subnetIds: [subnet.subnetId],
 *   minSize: 1,
 *   maxSize: 3,
 * });
 * ```
 *
 * **Example:** Reference an existing Launch Template by name
 * ```typescript
 * const group = yield* AutoScalingGroup("Fleet", {
 *   launchTemplate: { launchTemplateName: "my-template", version: 2 },
 *   subnetIds: [subnet.subnetId],
 *   minSize: 0,
 *   maxSize: 0,
 *   desiredCapacity: 0,
 * });
 * ```
 *
 * ### Load Balancing
 * **Example:** Register the fleet with a target group
 * ```typescript
 * const group = yield* AutoScalingGroup("WebFleet", {
 *   launchTemplate: template,
 *   subnetIds: [subnetA.subnetId, subnetB.subnetId],
 *   minSize: 2,
 *   maxSize: 6,
 *   targetGroupArns: [targetGroup.targetGroupArn],
 *   // healthCheckType defaults to "ELB" when target groups are attached
 *   healthCheckGracePeriod: "5 minutes",
 * });
 * ```
 *
 * ### Scaling
 * **Example:** Track average CPU utilization
 * ```typescript
 * import { ScalingPolicy } from "alchemy/AWS/AutoScaling";
 *
 * yield* ScalingPolicy("CpuPolicy", {
 *   autoScalingGroup: group,
 *   predefinedMetricType: "ASGAverageCPUUtilization",
 *   targetValue: 60,
 * });
 * ```
 *
 * @resource
 */
export const AutoScalingGroup = Resource("AWS.AutoScaling.AutoScalingGroup");
const sortStrings = (values = []) => [...values].sort((a, b) => a.localeCompare(b));
export const AutoScalingGroupProvider = () => Provider.effect(AutoScalingGroup, Effect.gen(function* () {
    const toName = (id, props = {}) => props.autoScalingGroupName
        ? Effect.succeed(props.autoScalingGroupName)
        : createPhysicalName({ id, maxLength: 255, lowercase: true });
    const toLaunchTemplateSpec = (input) => {
        // A whole-resource `launchTemplate: template` resolves to the
        // LaunchTemplate's bare Attributes before reaching the provider —
        // the resource `Type` marker does not survive resolution — so narrow
        // on the attributes shape (`launchTemplateArn` exists only on
        // attributes, never on a LaunchTemplateReference). Attributes carry
        // BOTH id and name, and the API rejects a spec with both, so send
        // the id alone.
        const attrs = input;
        if (typeof attrs?.launchTemplateArn === "string") {
            return {
                LaunchTemplateId: attrs.launchTemplateId,
                LaunchTemplateName: undefined,
                Version: attrs.defaultVersionNumber === undefined
                    ? "$Default"
                    : String(attrs.defaultVersionNumber),
            };
        }
        const spec = (input ?? {});
        return {
            LaunchTemplateId: spec.launchTemplateId,
            LaunchTemplateName: spec.launchTemplateName,
            Version: spec.version === undefined ? "$Default" : String(spec.version),
        };
    };
    const describeGroup = (autoScalingGroupName) => autoscaling
        .describeAutoScalingGroups({
        AutoScalingGroupNames: [autoScalingGroupName],
    })
        .pipe(Effect.map((result) => result.AutoScalingGroups?.[0]));
    const toTags = (name, tags) => Object.entries(tags).map(([Key, Value]) => ({
        ResourceId: name,
        ResourceType: "auto-scaling-group",
        Key,
        Value,
        PropagateAtLaunch: false,
    }));
    const syncTargetGroups = Effect.fn(function* ({ autoScalingGroupName, oldTargetGroupArns, newTargetGroupArns, }) {
        const oldSet = new Set(oldTargetGroupArns);
        const newSet = new Set(newTargetGroupArns);
        const detached = oldTargetGroupArns.filter((arn) => !newSet.has(arn));
        const attached = newTargetGroupArns.filter((arn) => !oldSet.has(arn));
        if (detached.length > 0) {
            yield* autoscaling.detachLoadBalancerTargetGroups({
                AutoScalingGroupName: autoScalingGroupName,
                TargetGroupARNs: detached,
            });
        }
        if (attached.length > 0) {
            yield* autoscaling.attachLoadBalancerTargetGroups({
                AutoScalingGroupName: autoScalingGroupName,
                TargetGroupARNs: attached,
            });
        }
    });
    const syncTags = Effect.fn(function* ({ autoScalingGroupName, oldTags, newTags, }) {
        const { removed, upsert } = diffTags(oldTags, newTags);
        if (removed.length > 0) {
            yield* autoscaling.deleteTags({
                Tags: removed.map((Key) => ({
                    ResourceId: autoScalingGroupName,
                    ResourceType: "auto-scaling-group",
                    Key,
                })),
            });
        }
        if (upsert.length > 0) {
            yield* autoscaling.createOrUpdateTags({
                Tags: upsert.map(({ Key, Value }) => ({
                    ResourceId: autoScalingGroupName,
                    ResourceType: "auto-scaling-group",
                    Key,
                    Value,
                    PropagateAtLaunch: false,
                })),
            });
        }
    });
    const toAttributes = (group) => ({
        autoScalingGroupArn: group.AutoScalingGroupARN,
        autoScalingGroupName: group.AutoScalingGroupName,
        launchTemplateId: group.LaunchTemplate?.LaunchTemplateId,
        launchTemplateName: group.LaunchTemplate?.LaunchTemplateName,
        launchTemplateVersion: group.LaunchTemplate?.Version,
        subnetIds: String(group.VPCZoneIdentifier ?? "")
            .split(",")
            .filter(Boolean),
        minSize: group.MinSize ?? 0,
        maxSize: group.MaxSize ?? 0,
        desiredCapacity: group.DesiredCapacity ?? 0,
        targetGroupArns: sortStrings(group.TargetGroupARNs ?? []),
        healthCheckType: group.HealthCheckType,
        healthCheckGracePeriod: group.HealthCheckGracePeriod,
        defaultCooldown: group.DefaultCooldown,
        terminationPolicies: group.TerminationPolicies ?? [],
        tags: Object.fromEntries((group.Tags ?? [])
            .filter((tag) => Boolean(tag.Key && tag.Value !== undefined))
            .map((tag) => [tag.Key, tag.Value])),
    });
    return {
        stables: ["autoScalingGroupArn", "autoScalingGroupName"],
        list: () => 
        // `describeAutoScalingGroups` is paginated; collect every page and
        // flatten the `AutoScalingGroups` array into full `Attributes`.
        autoscaling.describeAutoScalingGroups.pages({}).pipe(Stream.runCollect, Effect.map((chunk) => Array.from(chunk).flatMap((page) => (page.AutoScalingGroups ?? []).map(toAttributes)))),
        diff: Effect.fn(function* ({ id, olds, news: _news }) {
            if (!isResolved(_news))
                return undefined;
            const news = _news;
            const oldName = yield* toName(id, olds ?? {});
            const newName = yield* toName(id, news ?? {});
            if (oldName !== newName) {
                return { action: "replace", deleteFirst: true };
            }
            if (!deepEqual(olds, news)) {
                return {
                    action: "update",
                    stables: ["autoScalingGroupArn", "autoScalingGroupName"],
                };
            }
        }),
        read: Effect.fn(function* ({ id, olds, output }) {
            const name = output?.autoScalingGroupName ?? (yield* toName(id, olds ?? {}));
            const group = yield* describeGroup(name);
            return group ? toAttributes(group) : undefined;
        }),
        reconcile: Effect.fn(function* ({ id, news, output, session }) {
            const autoScalingGroupName = output?.autoScalingGroupName ?? (yield* toName(id, news));
            const desiredTags = {
                ...(yield* createInternalTags(id)),
                ...news.tags,
            };
            const targetGroupArns = sortStrings((news.targetGroupArns ?? []));
            const launchTemplate = toLaunchTemplateSpec(news.launchTemplate);
            const healthCheckType = news.healthCheckType ??
                (targetGroupArns.length > 0 ? "ELB" : "EC2");
            // Observe — fetch live state. `describeAutoScalingGroups` returns
            // an empty list when the ASG is missing; we never trust `output`
            // alone since the ASG may have been deleted out of band.
            let existing = yield* describeGroup(autoScalingGroupName);
            // Ensure — create the ASG if missing. `createAutoScalingGroup`
            // raises `AlreadyExistsFault` on a race; we fall through to the
            // sync path on that case.
            if (!existing) {
                yield* autoscaling
                    .createAutoScalingGroup({
                    AutoScalingGroupName: autoScalingGroupName,
                    MinSize: news.minSize,
                    MaxSize: news.maxSize,
                    DesiredCapacity: news.desiredCapacity ?? news.minSize,
                    LaunchTemplate: launchTemplate,
                    VPCZoneIdentifier: news.subnetIds.join(","),
                    TargetGroupARNs: targetGroupArns,
                    HealthCheckType: healthCheckType,
                    HealthCheckGracePeriod: toSeconds(news.healthCheckGracePeriod),
                    DefaultCooldown: toSeconds(news.defaultCooldown),
                    TerminationPolicies: news.terminationPolicies,
                    Tags: toTags(autoScalingGroupName, desiredTags),
                })
                    .pipe(Effect.catch((error) => error?._tag === "AlreadyExistsFault"
                    ? Effect.void
                    : Effect.fail(error)));
                existing = yield* describeGroup(autoScalingGroupName).pipe(Effect.filterOrFail(Boolean, () => new Error(`Auto Scaling Group '${autoScalingGroupName}' was not readable after create`)), Effect.retry({
                    while: () => true,
                    schedule: Schedule.max([
                        Schedule.recurs(8),
                        Schedule.exponential("250 millis"),
                    ]),
                }));
            }
            // Sync core ASG configuration — `updateAutoScalingGroup`
            // overwrites min/max/desired/template/subnets/health-check
            // settings in one call, so we issue it unconditionally
            // (idempotent for matching values).
            yield* autoscaling.updateAutoScalingGroup({
                AutoScalingGroupName: autoScalingGroupName,
                MinSize: news.minSize,
                MaxSize: news.maxSize,
                DesiredCapacity: news.desiredCapacity ?? news.minSize,
                LaunchTemplate: launchTemplate,
                VPCZoneIdentifier: news.subnetIds.join(","),
                HealthCheckType: healthCheckType,
                HealthCheckGracePeriod: toSeconds(news.healthCheckGracePeriod),
                DefaultCooldown: toSeconds(news.defaultCooldown),
                TerminationPolicies: news.terminationPolicies,
            });
            // Sync target groups — observed cloud attachments vs desired.
            const observedAttrs = toAttributes(existing);
            yield* syncTargetGroups({
                autoScalingGroupName,
                oldTargetGroupArns: sortStrings(existing.TargetGroupARNs ?? []),
                newTargetGroupArns: targetGroupArns,
            });
            // Sync tags — observed cloud tags vs desired. Adoption brings
            // tags through `existing.Tags`; we converge regardless of what
            // was there before.
            yield* syncTags({
                autoScalingGroupName,
                oldTags: observedAttrs.tags,
                newTags: desiredTags,
            });
            // Re-read final state so attributes reflect post-sync cloud
            // state.
            const group = yield* describeGroup(autoScalingGroupName).pipe(Effect.filterOrFail(Boolean, () => new Error(`Auto Scaling Group '${autoScalingGroupName}' was not readable after reconcile`)));
            yield* session.note(autoScalingGroupName);
            return toAttributes(group);
        }),
        delete: Effect.fn(function* ({ output }) {
            const existing = yield* describeGroup(output.autoScalingGroupName);
            if (!existing) {
                return;
            }
            yield* autoscaling.deleteAutoScalingGroup({
                AutoScalingGroupName: output.autoScalingGroupName,
                ForceDelete: true,
            });
            yield* describeGroup(output.autoScalingGroupName).pipe(Effect.flatMap((group) => group
                ? Effect.fail(new Error("AutoScalingGroupStillExists"))
                : Effect.void), Effect.retry({
                while: (error) => error.message === "AutoScalingGroupStillExists",
                schedule: Schedule.max([
                    Schedule.recurs(12),
                    Schedule.exponential("250 millis"),
                ]),
            }));
        }),
    };
}));
//# sourceMappingURL=AutoScalingGroup.js.map