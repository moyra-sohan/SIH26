import * as sesv2 from "@distilled.cloud/aws/sesv2";
import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";
import { isResolved } from "../../Diff.js";
import { createPhysicalName } from "../../PhysicalName.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
/**
 * An event destination on an SES v2 configuration set — streams
 * send/delivery/bounce/complaint (and open/click) events to SNS,
 * EventBridge, or CloudWatch.
 * ### Creating Event Destinations
 * **Example:** Publish Bounce and Complaint Events to SNS
 * ```typescript
 * import * as SES from "alchemy/AWS/SES";
 * import * as SNS from "alchemy/AWS/SNS";
 *
 * const topic = yield* SNS.Topic("EmailEvents", {});
 * const configSet = yield* SES.ConfigurationSet("Default", {});
 *
 * const destination = yield* SES.ConfigurationSetEventDestination("ToSns", {
 *   configurationSetName: configSet.configurationSetName,
 *   matchingEventTypes: ["BOUNCE", "COMPLAINT"],
 *   snsDestination: { topicArn: topic.topicArn },
 * });
 * ```
 *
 * **Example:** Publish Metrics to CloudWatch
 * ```typescript
 * const metrics = yield* SES.ConfigurationSetEventDestination("Metrics", {
 *   configurationSetName: configSet.configurationSetName,
 *   matchingEventTypes: ["SEND", "DELIVERY"],
 *   cloudWatchDestination: {
 *     dimensionConfigurations: [
 *       {
 *         dimensionName: "campaign",
 *         dimensionValueSource: "MESSAGE_TAG",
 *         defaultDimensionValue: "none",
 *       },
 *     ],
 *   },
 * });
 * ```
 *
 * @resource
 */
export const ConfigurationSetEventDestination = Resource("AWS.SES.ConfigurationSetEventDestination");
const toDefinition = (props) => ({
    Enabled: props.enabled ?? true,
    MatchingEventTypes: props.matchingEventTypes,
    SnsDestination: props.snsDestination
        ? { TopicArn: props.snsDestination.topicArn }
        : undefined,
    EventBridgeDestination: props.eventBridgeDestination
        ? { EventBusArn: props.eventBridgeDestination.eventBusArn }
        : undefined,
    CloudWatchDestination: props.cloudWatchDestination
        ? {
            DimensionConfigurations: props.cloudWatchDestination.dimensionConfigurations.map((d) => ({
                DimensionName: d.dimensionName,
                DimensionValueSource: d.dimensionValueSource,
                DefaultDimensionValue: d.defaultDimensionValue,
            })),
        }
        : undefined,
});
const isInSync = (observed, desired) => {
    const sortedTypes = (types) => [...(types ?? [])].sort();
    const observedTypes = sortedTypes(observed.MatchingEventTypes);
    const desiredTypes = sortedTypes(desired.MatchingEventTypes);
    return ((observed.Enabled ?? false) === (desired.Enabled ?? true) &&
        observedTypes.length === desiredTypes.length &&
        observedTypes.every((t, i) => t === desiredTypes[i]) &&
        observed.SnsDestination?.TopicArn === desired.SnsDestination?.TopicArn &&
        observed.EventBridgeDestination?.EventBusArn ===
            desired.EventBridgeDestination?.EventBusArn &&
        JSON.stringify(observed.CloudWatchDestination?.DimensionConfigurations ?? null) ===
            JSON.stringify(desired.CloudWatchDestination?.DimensionConfigurations ?? null));
};
export const ConfigurationSetEventDestinationProvider = () => Provider.effect(ConfigurationSetEventDestination, Effect.gen(function* () {
    const createName = Effect.fn(function* (id, props) {
        return (props.eventDestinationName ??
            (yield* createPhysicalName({ id, maxLength: 64 })));
    });
    const findDestination = Effect.fn(function* (configurationSetName, eventDestinationName) {
        const destinations = yield* sesv2
            .getConfigurationSetEventDestinations({
            ConfigurationSetName: configurationSetName,
        })
            .pipe(Effect.map((r) => r.EventDestinations ?? []), 
        // configuration set (or destination) missing → not found
        Effect.catchTag("NotFoundException", () => Effect.succeed([])));
        return destinations.find((d) => d.Name === eventDestinationName);
    });
    return ConfigurationSetEventDestination.Provider.of({
        stables: ["configurationSetName", "eventDestinationName"],
        list: () => Effect.gen(function* () {
            const pages = yield* sesv2.listConfigurationSets
                .pages({})
                .pipe(Stream.runCollect);
            const configSets = Array.from(pages).flatMap((page) => page.ConfigurationSets ?? []);
            const nested = yield* Effect.forEach(configSets, (configurationSetName) => sesv2
                .getConfigurationSetEventDestinations({
                ConfigurationSetName: configurationSetName,
            })
                .pipe(Effect.map((r) => (r.EventDestinations ?? []).map((d) => ({
                configurationSetName,
                eventDestinationName: d.Name,
            }))), Effect.catchTag("NotFoundException", () => Effect.succeed([]))), { concurrency: 2 });
            return nested.flat();
        }),
        read: Effect.fn(function* ({ id, olds, output }) {
            const configurationSetName = output?.configurationSetName ?? olds?.configurationSetName;
            if (configurationSetName === undefined)
                return undefined;
            const name = output?.eventDestinationName ?? (yield* createName(id, olds ?? {}));
            const found = yield* findDestination(configurationSetName, name);
            if (!found)
                return undefined;
            return { configurationSetName, eventDestinationName: name };
        }),
        diff: Effect.fn(function* ({ id, news, olds }) {
            if (!isResolved(news))
                return undefined;
            const oldName = yield* createName(id, olds ?? {});
            const newName = yield* createName(id, news ?? {});
            if (oldName !== newName ||
                (olds?.configurationSetName !== undefined &&
                    news?.configurationSetName !== undefined &&
                    olds.configurationSetName !== news.configurationSetName)) {
                return { action: "replace" };
            }
        }),
        reconcile: Effect.fn(function* ({ id, news, output, session }) {
            const configurationSetName = news.configurationSetName;
            const name = output?.eventDestinationName ?? (yield* createName(id, news));
            const desired = toDefinition(news);
            // 1. OBSERVE — look the destination up on the owning set.
            const observed = yield* findDestination(configurationSetName, name);
            if (observed === undefined) {
                // 2. ENSURE — create; AlreadyExists is a race → converge with
                //    an update instead.
                yield* sesv2
                    .createConfigurationSetEventDestination({
                    ConfigurationSetName: configurationSetName,
                    EventDestinationName: name,
                    EventDestination: desired,
                })
                    .pipe(Effect.catchTag("AlreadyExistsException", () => sesv2.updateConfigurationSetEventDestination({
                    ConfigurationSetName: configurationSetName,
                    EventDestinationName: name,
                    EventDestination: desired,
                })));
            }
            else if (!isInSync(observed, desired)) {
                // 3. SYNC — apply the delta only when observed drifted.
                yield* sesv2.updateConfigurationSetEventDestination({
                    ConfigurationSetName: configurationSetName,
                    EventDestinationName: name,
                    EventDestination: desired,
                });
            }
            yield* session.note(`${configurationSetName}/${name}`);
            return { configurationSetName, eventDestinationName: name };
        }),
        delete: Effect.fn(function* ({ output }) {
            yield* sesv2
                .deleteConfigurationSetEventDestination({
                ConfigurationSetName: output.configurationSetName,
                EventDestinationName: output.eventDestinationName,
            })
                .pipe(Effect.catchTag("NotFoundException", () => Effect.void));
        }),
    });
}));
//# sourceMappingURL=ConfigurationSetEventDestination.js.map