import * as greengrassv2 from "@distilled.cloud/aws/greengrassv2";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Schedule from "effect/Schedule";
import * as Stream from "effect/Stream";
import { Unowned } from "../../AdoptPolicy.js";
import { isResolved } from "../../Diff.js";
import { createPhysicalName } from "../../PhysicalName.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
import { createInternalTags, diffTags, hasAlchemyTags } from "../../Tags.js";
import { AWSEnvironment } from "../Environment.js";
/**
 * An IoT Greengrass V2 continuous deployment that installs a set of component
 * versions on a target IoT thing or thing group.
 *
 * Updating the deployment's components or name creates a new deployment
 * revision for the target (the `deploymentId` attribute changes); the
 * previous revision is canceled and deleted.
 *
 * ### Creating Deployments
 * **Example:** Deploy a component to a thing
 * ```typescript
 * import * as GreengrassV2 from "alchemy/AWS/GreengrassV2";
 * import * as IoT from "alchemy/AWS/IoT";
 *
 * const core = yield* IoT.Thing("Core", {});
 * const component = yield* GreengrassV2.ComponentVersion("Hello", { recipe });
 *
 * const deployment = yield* GreengrassV2.Deployment("Rollout", {
 *   targetArn: core.thingArn,
 *   components: {
 *     [component.componentName]: {
 *       componentVersion: component.componentVersion,
 *     },
 *   },
 * });
 * ```
 *
 * **Example:** Deployment with a configuration update
 * ```typescript
 * const deployment = yield* GreengrassV2.Deployment("Rollout", {
 *   targetArn: core.thingArn,
 *   components: {
 *     "com.example.Hello": {
 *       componentVersion: "1.0.0",
 *       configurationUpdate: { merge: JSON.stringify({ interval: 30 }) },
 *     },
 *   },
 * });
 * ```
 *
 * @resource
 */
export const Deployment = Resource("AWS.GreengrassV2.Deployment");
/**
 * Raised when `createDeployment` returns without a deployment ID, which the
 * provider needs to track the deployment revision.
 */
export class GreengrassDeploymentMissingId extends Data.TaggedError("GreengrassDeploymentMissingId") {
}
// Explicitly-typed pipeable retry helper (see EC2/VolumeAttachment.ts) —
// deleting a deployment right after cancellation can race the state change.
const retryWhileConflict = (self) => Effect.retry(self, {
    while: (e) => e._tag === "ConflictException",
    schedule: Schedule.max([Schedule.fixed(2000), Schedule.recurs(10)]),
});
const normalizeTags = (tags) => Object.fromEntries(Object.entries(tags ?? {}).filter((entry) => entry[1] !== undefined));
const canonicalComponents = (components) => JSON.stringify(Object.keys(components ?? {})
    .sort()
    .flatMap((name) => {
    const spec = components?.[name];
    return spec === undefined
        ? []
        : [
            [
                name,
                {
                    componentVersion: spec.componentVersion,
                    merge: spec.configurationUpdate?.merge,
                    reset: spec.configurationUpdate?.reset?.slice().sort(),
                },
            ],
        ];
}));
export const DeploymentProvider = () => Provider.effect(Deployment, Effect.gen(function* () {
    const createDeploymentName = Effect.fn(function* (id, props) {
        return props.deploymentName ?? (yield* createPhysicalName({ id }));
    });
    const deploymentArn = Effect.fn(function* (deploymentId) {
        const { accountId, region } = yield* AWSEnvironment.current;
        return `arn:aws:greengrass:${region}:${accountId}:deployments:${deploymentId}`;
    });
    const observeDeployment = (deploymentId) => greengrassv2
        .getDeployment({ deploymentId })
        .pipe(Effect.catchTag("ResourceNotFoundException", () => Effect.succeed(undefined)));
    // The latest deployment revision for a target (cloud-authoritative).
    const observeLatestForTarget = (targetArn) => Effect.gen(function* () {
        const deployments = yield* greengrassv2.listDeployments
            .items({ targetArn, historyFilter: "LATEST_ONLY" })
            .pipe(Stream.runCollect);
        const latest = Array.from(deployments)[0];
        if (latest?.deploymentId === undefined)
            return undefined;
        return yield* observeDeployment(latest.deploymentId);
    });
    const attributesOf = Effect.fn(function* (live, fallbackTargetArn) {
        const deploymentId = live.deploymentId;
        if (deploymentId === undefined) {
            return yield* Effect.fail(new GreengrassDeploymentMissingId({
                message: "getDeployment returned no deploymentId",
            }));
        }
        return {
            deploymentId,
            deploymentArn: yield* deploymentArn(deploymentId),
            targetArn: live.targetArn ?? fallbackTargetArn,
            revisionId: live.revisionId,
            deploymentStatus: live.deploymentStatus,
            iotJobId: live.iotJobId,
            iotJobArn: live.iotJobArn,
        };
    });
    // Cancel (if still active) and delete a superseded/destroyed revision.
    const cancelAndDelete = (deploymentId) => Effect.gen(function* () {
        yield* greengrassv2.cancelDeployment({ deploymentId }).pipe(
        // Already completed/canceled/inactive revisions reject the
        // cancellation — that is exactly the state we want.
        Effect.catchTag([
            "ResourceNotFoundException",
            "ConflictException",
            "ValidationException",
        ], () => Effect.succeed(undefined)));
        yield* greengrassv2
            .deleteDeployment({ deploymentId })
            .pipe(retryWhileConflict)
            .pipe(Effect.catchTag("ResourceNotFoundException", () => Effect.void));
    });
    return Deployment.Provider.of({
        stables: ["targetArn"],
        list: () => Effect.gen(function* () {
            const deployments = yield* greengrassv2.listDeployments
                .items({ historyFilter: "LATEST_ONLY" })
                .pipe(Stream.runCollect);
            const results = [];
            for (const deployment of deployments) {
                if (deployment.deploymentId === undefined ||
                    deployment.targetArn === undefined) {
                    continue;
                }
                results.push({
                    deploymentId: deployment.deploymentId,
                    deploymentArn: yield* deploymentArn(deployment.deploymentId),
                    targetArn: deployment.targetArn,
                    revisionId: deployment.revisionId,
                    deploymentStatus: deployment.deploymentStatus,
                });
            }
            return results;
        }),
        read: Effect.fn(function* ({ id, olds, output }) {
            const live = output?.deploymentId !== undefined
                ? yield* observeDeployment(output.deploymentId)
                : olds !== undefined
                    ? yield* observeLatestForTarget(olds.targetArn)
                    : undefined;
            if (live?.deploymentId === undefined)
                return undefined;
            const attrs = yield* attributesOf(live, output?.targetArn ?? olds?.targetArn ?? "");
            return (yield* hasAlchemyTags(id, normalizeTags(live.tags)))
                ? attrs
                : Unowned(attrs);
        }),
        diff: Effect.fn(function* ({ news, olds }) {
            if (!isResolved(news))
                return undefined;
            // A deployment belongs to exactly one target.
            if (olds !== undefined && news.targetArn !== olds.targetArn) {
                return { action: "replace" };
            }
            // fall through: engine default update (new revision in reconcile)
        }),
        reconcile: Effect.fn(function* ({ id, news, output, session }) {
            const deploymentName = yield* createDeploymentName(id, news);
            const internalTags = yield* createInternalTags(id);
            const desiredTags = { ...news.tags, ...internalTags };
            const desiredComponents = canonicalComponents(news.components);
            // 1. OBSERVE — the latest revision for the target is authoritative;
            //    output.deploymentId is only a cache of the revision we made.
            let live = yield* observeLatestForTarget(news.targetArn);
            // 2. ENSURE/SYNC — a deployment revision is immutable: when the
            //    observed latest revision drifts from the desired spec (or none
            //    exists), create a new revision that supersedes it.
            const inSync = live !== undefined &&
                live.deploymentName === deploymentName &&
                canonicalComponents(live.components) === desiredComponents;
            if (!inSync) {
                const created = yield* greengrassv2.createDeployment({
                    targetArn: news.targetArn,
                    deploymentName,
                    components: news.components ?? {},
                    tags: desiredTags,
                });
                if (created.deploymentId === undefined) {
                    return yield* Effect.fail(new GreengrassDeploymentMissingId({
                        message: `createDeployment for ${news.targetArn} returned no deploymentId`,
                    }));
                }
                // Clean up the revision we previously created, now superseded.
                if (output?.deploymentId !== undefined &&
                    output.deploymentId !== created.deploymentId) {
                    yield* cancelAndDelete(output.deploymentId);
                }
                live = yield* observeDeployment(created.deploymentId);
                if (live === undefined) {
                    return yield* Effect.fail(new GreengrassDeploymentMissingId({
                        message: `deployment ${created.deploymentId} disappeared after creation`,
                    }));
                }
            }
            // Post-ensure narrowing: `inSync` implies `live` was observed and
            // the !inSync branch re-observed after create, but TS cannot track
            // that through the reassignment — guard with a typed error.
            if (live === undefined) {
                return yield* Effect.fail(new GreengrassDeploymentMissingId({
                    message: `no deployment observed for target ${news.targetArn} after reconcile`,
                }));
            }
            const attrs = yield* attributesOf(live, news.targetArn);
            // 3. SYNC TAGS — diff against OBSERVED cloud tags so adoption and
            //    no-op updates converge (create-time tags only apply on create).
            const observedTags = normalizeTags(live.tags);
            const { upsert, removed } = diffTags(observedTags, desiredTags);
            if (upsert.length > 0) {
                yield* greengrassv2.tagResource({
                    resourceArn: attrs.deploymentArn,
                    tags: Object.fromEntries(upsert.map((t) => [t.Key, t.Value])),
                });
            }
            if (removed.length > 0) {
                yield* greengrassv2.untagResource({
                    resourceArn: attrs.deploymentArn,
                    tagKeys: removed,
                });
            }
            yield* session.note(attrs.deploymentId);
            return attrs;
        }),
        delete: Effect.fn(function* ({ output }) {
            yield* cancelAndDelete(output.deploymentId);
        }),
    });
}));
//# sourceMappingURL=Deployment.js.map