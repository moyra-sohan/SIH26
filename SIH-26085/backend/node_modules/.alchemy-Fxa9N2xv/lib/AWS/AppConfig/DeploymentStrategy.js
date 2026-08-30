import * as appconfig from "@distilled.cloud/aws/appconfig";
import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";
import { Unowned } from "../../AdoptPolicy.js";
import { isResolved } from "../../Diff.js";
import { createPhysicalName } from "../../PhysicalName.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
import { createInternalTags, hasAlchemyTags } from "../../Tags.js";
import { toWireMinutes } from "../../Util/Duration.js";
import { AWSEnvironment } from "../Environment.js";
import { deploymentStrategyArn, readAppConfigTags, syncAppConfigTags, } from "./internal.js";
/**
 * An AWS AppConfig deployment strategy — defines how a configuration version
 * rolls out to an environment: the total duration, the per-interval growth,
 * and the final bake time during which alarms can trigger a rollback.
 *
 * ### Creating a Deployment Strategy
 * **Example:** All-At-Once (instant, no bake)
 * ```typescript
 * const strategy = yield* AppConfig.DeploymentStrategy("Fast", {
 *   deploymentDuration: 0,
 *   growthFactor: 100,
 *   finalBakeTime: 0,
 *   replicateTo: "NONE",
 * });
 * ```
 *
 * **Example:** Linear rollout over 10 minutes
 * ```typescript
 * const strategy = yield* AppConfig.DeploymentStrategy("Linear", {
 *   deploymentDuration: "10 minutes",
 *   growthFactor: 25,
 *   growthType: "LINEAR",
 *   finalBakeTime: "5 minutes",
 * });
 * ```
 *
 * @resource
 */
export const DeploymentStrategy = Resource("AWS.AppConfig.DeploymentStrategy");
export const DeploymentStrategyProvider = () => Provider.effect(DeploymentStrategy, Effect.gen(function* () {
    const toName = (id, props) => props.deploymentStrategyName
        ? Effect.succeed(props.deploymentStrategyName)
        : createPhysicalName({ id, maxLength: 64 });
    const readStrategy = Effect.fn(function* (deploymentStrategyId) {
        return yield* appconfig
            .getDeploymentStrategy({ DeploymentStrategyId: deploymentStrategyId })
            .pipe(Effect.catchTag("ResourceNotFoundException", () => Effect.succeed(undefined)));
    });
    const findByName = Effect.fn(function* (name) {
        const strategies = yield* appconfig.listDeploymentStrategies
            .pages({})
            .pipe(Stream.runCollect, Effect.map((chunk) => Array.from(chunk).flatMap((page) => page.Items ?? [])));
        return strategies.find((s) => s.Name === name);
    });
    return {
        stables: [
            "deploymentStrategyId",
            "deploymentStrategyName",
            "deploymentStrategyArn",
        ],
        diff: Effect.fn(function* ({ id, olds, news }) {
            if (!isResolved(news))
                return undefined;
            if ((yield* toName(id, olds ?? {})) !== (yield* toName(id, news ?? {}))) {
                return { action: "replace" };
            }
            // ReplicateTo is create-only.
            if ((olds?.replicateTo ?? "NONE") !== (news?.replicateTo ?? "NONE")) {
                return { action: "replace" };
            }
        }),
        read: Effect.fn(function* ({ id, olds, output }) {
            const { accountId, region } = yield* AWSEnvironment.current;
            const strategy = output?.deploymentStrategyId
                ? yield* readStrategy(output.deploymentStrategyId)
                : yield* findByName(yield* toName(id, olds ?? {}));
            if (strategy?.Id === undefined)
                return undefined;
            const arn = deploymentStrategyArn(region, accountId, strategy.Id);
            const attrs = {
                deploymentStrategyId: strategy.Id,
                deploymentStrategyName: strategy.Name,
                deploymentStrategyArn: arn,
            };
            const tags = yield* readAppConfigTags(arn);
            return (yield* hasAlchemyTags(id, tags)) ? attrs : Unowned(attrs);
        }),
        reconcile: Effect.fn(function* ({ id, news, output, session }) {
            const { accountId, region } = yield* AWSEnvironment.current;
            const name = output?.deploymentStrategyName ?? (yield* toName(id, news));
            const internalTags = yield* createInternalTags(id);
            const desiredTags = { ...internalTags, ...news.tags };
            // 1. Observe.
            let observed = output?.deploymentStrategyId
                ? yield* readStrategy(output.deploymentStrategyId)
                : undefined;
            if (observed === undefined) {
                observed = yield* findByName(name);
            }
            // 2. Ensure.
            if (observed?.Id === undefined) {
                observed = yield* appconfig.createDeploymentStrategy({
                    Name: name,
                    Description: news.description,
                    DeploymentDurationInMinutes: toWireMinutes(news.deploymentDuration),
                    FinalBakeTimeInMinutes: toWireMinutes(news.finalBakeTime),
                    GrowthFactor: news.growthFactor,
                    GrowthType: news.growthType,
                    ReplicateTo: news.replicateTo ?? "NONE",
                    Tags: desiredTags,
                });
            }
            else {
                // 3. Sync — everything but Name and ReplicateTo is mutable.
                observed = yield* appconfig.updateDeploymentStrategy({
                    DeploymentStrategyId: observed.Id,
                    Description: news.description,
                    DeploymentDurationInMinutes: toWireMinutes(news.deploymentDuration),
                    FinalBakeTimeInMinutes: toWireMinutes(news.finalBakeTime),
                    GrowthFactor: news.growthFactor,
                    GrowthType: news.growthType,
                });
            }
            const arn = deploymentStrategyArn(region, accountId, observed.Id);
            // 3b. Sync tags.
            yield* syncAppConfigTags(arn, desiredTags);
            yield* session.note(name);
            return {
                deploymentStrategyId: observed.Id,
                deploymentStrategyName: observed.Name ?? name,
                deploymentStrategyArn: arn,
            };
        }),
        delete: Effect.fn(function* ({ output }) {
            yield* appconfig
                .deleteDeploymentStrategy({
                DeploymentStrategyId: output.deploymentStrategyId,
            })
                .pipe(Effect.catchTag("ResourceNotFoundException", () => Effect.void));
        }),
        list: () => Effect.gen(function* () {
            const { accountId, region } = yield* AWSEnvironment.current;
            const strategies = yield* appconfig.listDeploymentStrategies
                .pages({})
                .pipe(Stream.runCollect, Effect.map((chunk) => Array.from(chunk).flatMap((page) => page.Items ?? [])));
            return strategies.flatMap((s) => s.Id !== undefined &&
                s.Name !== undefined &&
                // AWS-predefined strategies (AppConfig.AllAtOnce,
                // AppConfig.Linear50PercentEvery30Seconds, ...) are managed by
                // AWS and cannot be deleted — deleteDeploymentStrategy rejects
                // them with "Cannot delete predefined Deployment Strategy".
                !s.Id.startsWith("AppConfig.")
                ? [
                    {
                        deploymentStrategyId: s.Id,
                        deploymentStrategyName: s.Name,
                        deploymentStrategyArn: deploymentStrategyArn(region, accountId, s.Id),
                    },
                ]
                : []);
        }),
    };
}));
//# sourceMappingURL=DeploymentStrategy.js.map