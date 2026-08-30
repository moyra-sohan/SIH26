import * as codedeploy from "@distilled.cloud/aws/codedeploy";
import * as Effect from "effect/Effect";
import * as Schedule from "effect/Schedule";
import * as Stream from "effect/Stream";
import { isResolved } from "../../Diff.js";
import { createPhysicalName } from "../../PhysicalName.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
import { toWireSeconds } from "../../Util/Duration.js";
import { AWSEnvironment } from "../Environment.js";
/** Convert the zonal-config props to the CodeDeploy wire shape (seconds). */
const toWireZonalConfig = (props) => props === undefined
    ? undefined
    : {
        firstZoneMonitorDurationInSeconds: toWireSeconds(props.firstZoneMonitorDuration),
        monitorDurationInSeconds: toWireSeconds(props.monitorDuration),
        minimumHealthyHostsPerZone: props.minimumHealthyHostsPerZone,
    };
/**
 * A custom AWS CodeDeploy deployment configuration — the rules for how
 * traffic shifts during a deployment (canary/linear traffic routing for
 * `Lambda`/`ECS`, minimum-healthy-hosts and zonal rollout for `Server`).
 * Deployment configurations are immutable: any change replaces the
 * configuration.
 *
 * ### Creating a Deployment Config
 * **Example:** Lambda Canary Config
 * ```typescript
 * const config = yield* CodeDeploy.DeploymentConfig("canary", {
 *   computePlatform: "Lambda",
 *   trafficRoutingConfig: {
 *     type: "TimeBasedCanary",
 *     timeBasedCanary: { canaryPercentage: 10, canaryInterval: 5 },
 *   },
 * });
 * ```
 *
 * **Example:** Server Config with Minimum Healthy Hosts
 * ```typescript
 * const config = yield* CodeDeploy.DeploymentConfig("half-fleet", {
 *   computePlatform: "Server",
 *   minimumHealthyHosts: { type: "FLEET_PERCENT", value: 50 },
 * });
 * ```
 *
 * @resource
 */
export const DeploymentConfig = Resource("AWS.CodeDeploy.DeploymentConfig");
/** Build the ARN for a CodeDeploy deployment configuration. */
const deploymentConfigArn = (region, account, name) => `arn:aws:codedeploy:${region}:${account}:deploymentconfig:${name}`;
export const DeploymentConfigProvider = () => Provider.effect(DeploymentConfig, Effect.gen(function* () {
    const toName = (id, props) => props.deploymentConfigName
        ? Effect.succeed(props.deploymentConfigName)
        : createPhysicalName({ id, maxLength: 100 });
    const getConfig = Effect.fn(function* (name) {
        const response = yield* codedeploy
            .getDeploymentConfig({ deploymentConfigName: name })
            .pipe(Effect.catchTag("DeploymentConfigDoesNotExistException", () => Effect.succeed(undefined)));
        return response?.deploymentConfigInfo;
    });
    return {
        stables: [
            "deploymentConfigName",
            "deploymentConfigId",
            "computePlatform",
        ],
        diff: Effect.fn(function* ({ id, olds, news }) {
            if (!isResolved(news))
                return undefined;
            if ((yield* toName(id, olds ?? {})) !== (yield* toName(id, news ?? {}))) {
                return { action: "replace" };
            }
            // Deployment configurations are immutable — any settings change
            // replaces the configuration.
            const key = (props) => JSON.stringify([
                props.computePlatform ?? "Server",
                props.minimumHealthyHosts,
                props.trafficRoutingConfig,
                toWireZonalConfig(props.zonalConfig),
            ]);
            if (key(olds ?? {}) !== key(news ?? {})) {
                return { action: "replace" };
            }
        }),
        read: Effect.fn(function* ({ id, olds, output }) {
            const { accountId, region } = yield* AWSEnvironment.current;
            const name = output?.deploymentConfigName ?? (yield* toName(id, olds ?? {}));
            const config = yield* getConfig(name);
            if (config?.deploymentConfigId === undefined)
                return undefined;
            // Deployment configurations cannot be tagged, so there is no
            // ownership marker to check — a name match is treated as ours.
            return {
                deploymentConfigName: config.deploymentConfigName ?? name,
                deploymentConfigId: config.deploymentConfigId,
                deploymentConfigArn: deploymentConfigArn(region, accountId, name),
                computePlatform: config.computePlatform ?? "Server",
            };
        }),
        reconcile: Effect.fn(function* ({ id, news, output, session }) {
            const { accountId, region } = yield* AWSEnvironment.current;
            const name = output?.deploymentConfigName ?? (yield* toName(id, news));
            const computePlatform = news.computePlatform ?? "Server";
            // 1. Observe — cloud state is authoritative.
            let config = yield* getConfig(name);
            // 2. Ensure — create if missing (configs are immutable, so there
            //    is nothing to sync). Tolerate an already-exists race.
            if (config?.deploymentConfigId === undefined) {
                yield* codedeploy
                    .createDeploymentConfig({
                    deploymentConfigName: name,
                    computePlatform,
                    minimumHealthyHosts: news.minimumHealthyHosts,
                    trafficRoutingConfig: news.trafficRoutingConfig,
                    zonalConfig: toWireZonalConfig(news.zonalConfig),
                })
                    .pipe(Effect.catchTag("DeploymentConfigAlreadyExistsException", () => Effect.succeed(undefined)));
                config = yield* getConfig(name);
            }
            // 3. Return fresh attributes.
            yield* session.note(name);
            return {
                deploymentConfigName: config?.deploymentConfigName ?? name,
                deploymentConfigId: config?.deploymentConfigId ?? "",
                deploymentConfigArn: deploymentConfigArn(region, accountId, name),
                computePlatform: config?.computePlatform ?? computePlatform,
            };
        }),
        delete: Effect.fn(function* ({ output }) {
            // A config still referenced by a deployment group fails with
            // DeploymentConfigInUseException — the engine deletes dependents
            // first, but the reference release is eventually consistent, so
            // retry through it (bounded). Deleting a non-existent config
            // succeeds (no not-found variant in the typed error union).
            yield* codedeploy
                .deleteDeploymentConfig({
                deploymentConfigName: output.deploymentConfigName,
            })
                .pipe(Effect.retry({
                while: (e) => e._tag === "DeploymentConfigInUseException",
                schedule: Schedule.max([
                    Schedule.fixed(3000),
                    Schedule.recurs(10),
                ]),
            }));
        }),
        list: () => Effect.gen(function* () {
            const { accountId, region } = yield* AWSEnvironment.current;
            const names = yield* codedeploy.listDeploymentConfigs
                .pages({})
                .pipe(Stream.runCollect, Effect.map((chunk) => Array.from(chunk).flatMap((page) => page.deploymentConfigsList ?? [])));
            return (names
                // Predefined CodeDeployDefault.* configurations are
                // AWS-managed and cannot be deleted — never ours.
                .filter((name) => !name.startsWith("CodeDeployDefault."))
                .map((name) => ({
                deploymentConfigName: name,
                deploymentConfigId: "",
                deploymentConfigArn: deploymentConfigArn(region, accountId, name),
                computePlatform: "",
            })));
        }),
    };
}));
//# sourceMappingURL=DeploymentConfig.js.map