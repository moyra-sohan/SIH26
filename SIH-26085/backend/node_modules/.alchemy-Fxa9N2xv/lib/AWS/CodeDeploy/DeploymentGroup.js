import * as codedeploy from "@distilled.cloud/aws/codedeploy";
import * as Effect from "effect/Effect";
import * as Schedule from "effect/Schedule";
import { Unowned } from "../../AdoptPolicy.js";
import { isResolved } from "../../Diff.js";
import { createPhysicalName } from "../../PhysicalName.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
import { createInternalTags, diffTags, hasAlchemyTags } from "../../Tags.js";
import { toWireMinutes } from "../../Util/Duration.js";
import { AWSEnvironment } from "../Environment.js";
/** Convert the blue/green props to the CodeDeploy wire shape (minutes). */
const toWireBlueGreen = (props) => props === undefined
    ? undefined
    : {
        terminateBlueInstancesOnDeploymentSuccess: props.terminateBlueInstancesOnDeploymentSuccess === undefined
            ? undefined
            : {
                action: props.terminateBlueInstancesOnDeploymentSuccess.action,
                terminationWaitTimeInMinutes: toWireMinutes(props.terminateBlueInstancesOnDeploymentSuccess
                    .terminationWaitTime),
            },
        deploymentReadyOption: props.deploymentReadyOption === undefined
            ? undefined
            : {
                actionOnTimeout: props.deploymentReadyOption.actionOnTimeout,
                waitTimeInMinutes: toWireMinutes(props.deploymentReadyOption.waitTime),
            },
        greenFleetProvisioningOption: props.greenFleetProvisioningOption,
    };
/**
 * An AWS CodeDeploy deployment group — the set of target instances/functions
 * plus the deployment configuration for one {@link Application}. For the
 * `Lambda` compute platform a group ties a service role and a deployment
 * config (e.g. `CodeDeployDefault.LambdaAllAtOnce`) to an application.
 *
 * ### Creating a Deployment Group
 * **Example:** Lambda Deployment Group
 * ```typescript
 * const app = yield* CodeDeploy.Application("api", { computePlatform: "Lambda" });
 * const group = yield* CodeDeploy.DeploymentGroup("prod", {
 *   applicationName: app.applicationName,
 *   serviceRoleArn: role.roleArn,
 *   deploymentConfigName: "CodeDeployDefault.LambdaAllAtOnce",
 *   deploymentStyle: {
 *     deploymentType: "BLUE_GREEN",
 *     deploymentOption: "WITH_TRAFFIC_CONTROL",
 *   },
 *   autoRollbackConfiguration: {
 *     enabled: true,
 *     events: ["DEPLOYMENT_FAILURE"],
 *   },
 * });
 * ```
 *
 * @resource
 */
export const DeploymentGroup = Resource("AWS.CodeDeploy.DeploymentGroup");
/** Build the ARN for a CodeDeploy deployment group. */
const deploymentGroupArn = (region, account, appName, groupName) => `arn:aws:codedeploy:${region}:${account}:deploymentgroup:${appName}/${groupName}`;
/**
 * Retry an effect while CodeDeploy reports that it cannot yet assume the
 * service role. A freshly-created IAM role's trust relationship is eventually
 * consistent, so `InvalidRoleException` immediately after role creation is a
 * transient propagation error, not a permanent failure. Wrapped in an
 * explicitly-typed helper so the retry's conditional type never widens the
 * provider layer in declaration emit (see PATTERNS §7).
 */
const retryThroughRolePropagation = (effect) => effect.pipe(Effect.retry({
    while: (e) => e._tag === "InvalidRoleException",
    schedule: Schedule.max([Schedule.fixed(2000), Schedule.recurs(15)]),
}));
/** Convert a CodeDeploy wire tag list into a plain record. */
const toTagRecord = (tags) => Object.fromEntries((tags ?? [])
    .filter((tag) => typeof tag.Key === "string" && typeof tag.Value === "string")
    .map((tag) => [tag.Key, tag.Value]));
export const DeploymentGroupProvider = () => Provider.effect(DeploymentGroup, Effect.gen(function* () {
    const toName = (id, props) => props.deploymentGroupName
        ? Effect.succeed(props.deploymentGroupName)
        : createPhysicalName({ id, maxLength: 100 });
    const getGroup = Effect.fn(function* (appName, groupName) {
        const response = yield* codedeploy
            .getDeploymentGroup({
            applicationName: appName,
            deploymentGroupName: groupName,
        })
            .pipe(Effect.catchTag([
            "DeploymentGroupDoesNotExistException",
            "ApplicationDoesNotExistException",
        ], () => Effect.succeed(undefined)));
        return response?.deploymentGroupInfo;
    });
    const syncTags = Effect.fn(function* (arn, desiredTags) {
        const observed = yield* codedeploy
            .listTagsForResource({ ResourceArn: arn })
            .pipe(Effect.catch(() => Effect.succeed(undefined)));
        const { removed, upsert } = diffTags(toTagRecord(observed?.Tags), desiredTags);
        if (upsert.length > 0) {
            yield* codedeploy.tagResource({ ResourceArn: arn, Tags: upsert });
        }
        if (removed.length > 0) {
            yield* codedeploy.untagResource({
                ResourceArn: arn,
                TagKeys: removed,
            });
        }
    });
    return {
        stables: [
            "deploymentGroupName",
            "deploymentGroupId",
            "applicationName",
        ],
        diff: Effect.fn(function* ({ id, olds, news }) {
            if (!isResolved(news))
                return undefined;
            if ((yield* toName(id, olds ?? {})) !== (yield* toName(id, news ?? {}))) {
                return { action: "replace" };
            }
            // The parent application is immutable — replace on change.
            if ((news?.applicationName ?? "") !== (olds?.applicationName ?? "")) {
                return { action: "replace" };
            }
        }),
        read: Effect.fn(function* ({ id, olds, output }) {
            const { accountId, region } = yield* AWSEnvironment.current;
            const appName = output?.applicationName ?? olds?.applicationName;
            if (appName === undefined)
                return undefined;
            const name = output?.deploymentGroupName ?? (yield* toName(id, olds ?? {}));
            const group = yield* getGroup(appName, name);
            if (group?.deploymentGroupId === undefined)
                return undefined;
            const arn = deploymentGroupArn(region, accountId, appName, name);
            const attrs = {
                deploymentGroupName: group.deploymentGroupName ?? name,
                deploymentGroupId: group.deploymentGroupId,
                deploymentGroupArn: arn,
                applicationName: group.applicationName ?? appName,
                serviceRoleArn: group.serviceRoleArn ?? "",
            };
            const tags = yield* codedeploy
                .listTagsForResource({ ResourceArn: arn })
                .pipe(Effect.map((res) => toTagRecord(res.Tags)), Effect.catch(() => Effect.succeed({})));
            return (yield* hasAlchemyTags(id, tags)) ? attrs : Unowned(attrs);
        }),
        reconcile: Effect.fn(function* ({ id, news, output, session }) {
            const { accountId, region } = yield* AWSEnvironment.current;
            const appName = news.applicationName;
            const name = output?.deploymentGroupName ?? (yield* toName(id, news));
            const arn = deploymentGroupArn(region, accountId, appName, name);
            const internalTags = yield* createInternalTags(id);
            const desiredTags = { ...internalTags, ...news.tags };
            // 1. Observe — cloud state is authoritative.
            let group = yield* getGroup(appName, name);
            // 2. Ensure — create if missing; otherwise converge via update.
            if (group?.deploymentGroupId === undefined) {
                yield* retryThroughRolePropagation(codedeploy.createDeploymentGroup({
                    applicationName: appName,
                    deploymentGroupName: name,
                    serviceRoleArn: news.serviceRoleArn,
                    deploymentConfigName: news.deploymentConfigName,
                    deploymentStyle: news.deploymentStyle,
                    autoRollbackConfiguration: news.autoRollbackConfiguration,
                    alarmConfiguration: news.alarmConfiguration,
                    loadBalancerInfo: news.loadBalancerInfo,
                    blueGreenDeploymentConfiguration: toWireBlueGreen(news.blueGreenDeploymentConfiguration),
                    ec2TagFilters: news.ec2TagFilters,
                    autoScalingGroups: news.autoScalingGroups,
                    ecsServices: news.ecsServices,
                    triggerConfigurations: news.triggerConfigurations,
                    tags: Object.entries(desiredTags).map(([Key, Value]) => ({
                        Key,
                        Value,
                    })),
                })).pipe(Effect.catchTag("DeploymentGroupAlreadyExistsException", () => Effect.succeed(undefined)));
                group = yield* getGroup(appName, name);
            }
            else {
                // 3. Sync — converge mutable configuration in place.
                yield* codedeploy.updateDeploymentGroup({
                    applicationName: appName,
                    currentDeploymentGroupName: name,
                    serviceRoleArn: news.serviceRoleArn,
                    deploymentConfigName: news.deploymentConfigName,
                    deploymentStyle: news.deploymentStyle,
                    autoRollbackConfiguration: news.autoRollbackConfiguration,
                    alarmConfiguration: news.alarmConfiguration,
                    loadBalancerInfo: news.loadBalancerInfo,
                    blueGreenDeploymentConfiguration: toWireBlueGreen(news.blueGreenDeploymentConfiguration),
                    ec2TagFilters: news.ec2TagFilters,
                    autoScalingGroups: news.autoScalingGroups,
                    ecsServices: news.ecsServices,
                    triggerConfigurations: news.triggerConfigurations,
                });
                group = yield* getGroup(appName, name);
            }
            // 3b. Sync tags — diff against OBSERVED cloud tags.
            yield* syncTags(arn, desiredTags);
            // 4. Return fresh attributes.
            yield* session.note(name);
            return {
                deploymentGroupName: group?.deploymentGroupName ?? name,
                deploymentGroupId: group?.deploymentGroupId ?? "",
                deploymentGroupArn: arn,
                applicationName: group?.applicationName ?? appName,
                serviceRoleArn: group?.serviceRoleArn ?? news.serviceRoleArn,
            };
        }),
        delete: Effect.fn(function* ({ output, olds }) {
            const appName = output.applicationName || olds?.applicationName;
            if (appName === undefined)
                return;
            // DeleteDeploymentGroup is idempotent — deleting a non-existent
            // group (or one under a deleted application) succeeds; its typed
            // error union has no not-found variants.
            yield* codedeploy.deleteDeploymentGroup({
                applicationName: appName,
                deploymentGroupName: output.deploymentGroupName,
            });
        }),
        // Deployment groups are scoped to an application; there is no global
        // enumeration without knowing the application name.
        list: () => Effect.succeed([]),
    };
}));
//# sourceMappingURL=DeploymentGroup.js.map