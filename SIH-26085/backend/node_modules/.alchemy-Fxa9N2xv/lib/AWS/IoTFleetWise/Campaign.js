import * as iotfleetwise from "@distilled.cloud/aws/iotfleetwise";
import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";
import { Unowned } from "../../AdoptPolicy.js";
import { isResolved } from "../../Diff.js";
import { createPhysicalName } from "../../PhysicalName.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
import { createInternalTags, hasAlchemyTags } from "../../Tags.js";
import { toWireMillis, toWireSeconds } from "../../Util/Duration.js";
import { inFleetWiseRegion, readFleetWiseTags, retryObservation, stableEquals, syncFleetWiseTags, toFleetWiseTagList, } from "./internal.js";
const toWireCollectionScheme = (scheme) => scheme.timeBasedCollectionScheme !== undefined
    ? {
        timeBasedCollectionScheme: {
            periodMs: toWireMillis(scheme.timeBasedCollectionScheme.period),
        },
    }
    : {
        conditionBasedCollectionScheme: {
            expression: scheme.conditionBasedCollectionScheme.expression,
            minimumTriggerIntervalMs: toWireMillis(scheme.conditionBasedCollectionScheme.minimumTriggerInterval),
            triggerMode: scheme.conditionBasedCollectionScheme.triggerMode,
            conditionLanguageVersion: scheme.conditionBasedCollectionScheme.conditionLanguageVersion,
        },
    };
const toWireSignalsToCollect = (signals) => signals?.map((signal) => ({
    name: signal.name,
    maxSampleCount: signal.maxSampleCount,
    minimumSamplingIntervalMs: toWireMillis(signal.minimumSamplingInterval),
    dataPartitionId: signal.dataPartitionId,
}));
const toWireSignalsToFetch = (signals) => signals?.map((signal) => ({
    fullyQualifiedName: signal.fullyQualifiedName,
    signalFetchConfig: signal.signalFetchConfig.timeBased !== undefined
        ? {
            timeBased: {
                executionFrequencyMs: toWireMillis(signal.signalFetchConfig.timeBased.executionFrequency),
            },
        }
        : { conditionBased: signal.signalFetchConfig.conditionBased },
    conditionLanguageVersion: signal.conditionLanguageVersion,
    actions: signal.actions,
}));
/**
 * An AWS IoT FleetWise campaign — the orchestration of data-collection
 * rules that the Edge Agent uses to decide which signals to collect from
 * a {@link Fleet} or {@link Vehicle} and where to deliver them.
 *
 * Campaigns are created in `WAITING_FOR_APPROVAL` status; set
 * `autoApprove: true` to have the provider approve them into `RUNNING`.
 * Only the description and extra dimensions are mutable — every other
 * change replaces the campaign. AWS IoT FleetWise is allowlist-gated and
 * offered in `us-east-1`/`eu-central-1` only.
 * ### Creating a Campaign
 * **Example:** Time-Based Collection to S3
 * ```typescript
 * const campaign = yield* Campaign("SpeedTelemetry", {
 *   signalCatalogArn: catalog.signalCatalogArn,
 *   targetArn: fleet.fleetArn,
 *   collectionScheme: {
 *     timeBasedCollectionScheme: { period: "10 seconds" },
 *   },
 *   signalsToCollect: [{ name: "Vehicle.Speed" }],
 *   dataDestinationConfigs: [
 *     { s3Config: { bucketArn: bucket.bucketArn } },
 *   ],
 *   autoApprove: true,
 * });
 * ```
 *
 * **Example:** Condition-Based Collection
 * ```typescript
 * const campaign = yield* Campaign("HardBraking", {
 *   signalCatalogArn: catalog.signalCatalogArn,
 *   targetArn: fleet.fleetArn,
 *   collectionScheme: {
 *     conditionBasedCollectionScheme: {
 *       expression: "$variable.`Vehicle.Speed` > 120.0",
 *       minimumTriggerInterval: "5 seconds",
 *       triggerMode: "RISING_EDGE",
 *     },
 *   },
 *   signalsToCollect: [
 *     { name: "Vehicle.Speed", minimumSamplingInterval: "500 millis" },
 *   ],
 *   postTriggerCollectionDuration: "30 seconds",
 *   dataDestinationConfigs: [
 *     { s3Config: { bucketArn: bucket.bucketArn } },
 *   ],
 * });
 * ```
 *
 * @resource
 */
export const Campaign = Resource("AWS.IoTFleetWise.Campaign");
export const CampaignProvider = () => Provider.effect(Campaign, Effect.gen(function* () {
    const toName = (id, props) => props.campaignName
        ? Effect.succeed(props.campaignName)
        : createPhysicalName({ id, maxLength: 100 });
    const readCampaign = Effect.fn(function* (name) {
        return yield* iotfleetwise.getCampaign({ name }).pipe(inFleetWiseRegion, Effect.catchTag("ResourceNotFoundException", () => Effect.succeed(undefined)));
    });
    // Campaign provisioning is asynchronous (status CREATING). Bounded
    // wait until the service settles it into an actionable status.
    const waitUntilSettled = Effect.fn(function* (name) {
        return yield* readCampaign(name).pipe(Effect.flatMap((campaign) => {
            if (campaign === undefined) {
                return Effect.fail(new Error(`Campaign '${name}' not found`));
            }
            if (campaign.status === "CREATING") {
                return Effect.fail(new Error(`Campaign '${name}' still creating`));
            }
            return Effect.succeed(campaign);
        }), retryObservation);
    });
    const toAttrs = Effect.fn(function* (campaign) {
        if (campaign.name === undefined || campaign.arn === undefined) {
            return yield* Effect.fail(new Error(`Campaign '${campaign.name}' is missing its ARN`));
        }
        return {
            campaignName: campaign.name,
            campaignArn: campaign.arn,
            status: campaign.status ?? "CREATING",
            signalCatalogArn: campaign.signalCatalogArn,
            targetArn: campaign.targetArn,
        };
    });
    return {
        stables: ["campaignName", "campaignArn"],
        diff: Effect.fn(function* ({ id, olds, news }) {
            if (!isResolved(news))
                return undefined;
            if ((yield* toName(id, olds)) !== (yield* toName(id, news))) {
                return { action: "replace" };
            }
            // Only description and dataExtraDimensions are mutable; every
            // other property is fixed at creation.
            const createOnly = (props) => ({
                signalCatalogArn: props.signalCatalogArn,
                targetArn: props.targetArn,
                // Durations are compared in wire units so that equivalent
                // inputs ("10 seconds" vs 10_000) never force a replacement.
                collectionScheme: toWireCollectionScheme(props.collectionScheme),
                signalsToCollect: toWireSignalsToCollect(props.signalsToCollect),
                dataDestinationConfigs: props.dataDestinationConfigs,
                startTime: props.startTime,
                expiryTime: props.expiryTime,
                postTriggerCollectionDuration: toWireSeconds(props.postTriggerCollectionDuration),
                diagnosticsMode: props.diagnosticsMode,
                spoolingMode: props.spoolingMode,
                compression: props.compression,
                dataPartitions: props.dataPartitions,
                signalsToFetch: toWireSignalsToFetch(props.signalsToFetch),
            });
            if (!stableEquals(createOnly(olds), createOnly(news))) {
                return { action: "replace" };
            }
        }),
        read: Effect.fn(function* ({ id, olds, output }) {
            const name = output?.campaignName ?? (yield* toName(id, olds ?? {}));
            const found = yield* readCampaign(name);
            if (found?.arn === undefined)
                return undefined;
            const attrs = yield* toAttrs(found);
            const tags = yield* readFleetWiseTags(found.arn);
            return (yield* hasAlchemyTags(id, tags)) ? attrs : Unowned(attrs);
        }),
        reconcile: Effect.fn(function* ({ id, news, output, session }) {
            const name = output?.campaignName ?? (yield* toName(id, news));
            const internalTags = yield* createInternalTags(id);
            const desiredTags = { ...internalTags, ...news.tags };
            // 1. Observe — cloud state is authoritative.
            let observed = yield* readCampaign(name);
            // 2. Ensure — create if missing; tolerate the AlreadyExists race.
            if (observed === undefined) {
                yield* iotfleetwise
                    .createCampaign({
                    name,
                    description: news.description,
                    signalCatalogArn: news.signalCatalogArn,
                    targetArn: news.targetArn,
                    collectionScheme: toWireCollectionScheme(news.collectionScheme),
                    signalsToCollect: toWireSignalsToCollect(news.signalsToCollect),
                    dataDestinationConfigs: news.dataDestinationConfigs,
                    startTime: news.startTime !== undefined
                        ? new Date(news.startTime)
                        : undefined,
                    expiryTime: news.expiryTime !== undefined
                        ? new Date(news.expiryTime)
                        : undefined,
                    postTriggerCollectionDuration: toWireSeconds(news.postTriggerCollectionDuration),
                    diagnosticsMode: news.diagnosticsMode,
                    spoolingMode: news.spoolingMode,
                    compression: news.compression,
                    dataExtraDimensions: news.dataExtraDimensions,
                    dataPartitions: news.dataPartitions,
                    signalsToFetch: toWireSignalsToFetch(news.signalsToFetch),
                    tags: toFleetWiseTagList(desiredTags),
                })
                    .pipe(inFleetWiseRegion, Effect.catchTag("ConflictException", () => Effect.void));
            }
            observed = yield* waitUntilSettled(name);
            // 3. Sync mutable aspects — description / dataExtraDimensions via
            //    the UPDATE action, applied only on an observed delta.
            const descriptionChanged = news.description !== undefined &&
                news.description !== observed.description;
            const dimensionsChanged = news.dataExtraDimensions !== undefined &&
                !stableEquals(observed.dataExtraDimensions ?? [], news.dataExtraDimensions);
            if (descriptionChanged || dimensionsChanged) {
                yield* iotfleetwise
                    .updateCampaign({
                    name,
                    action: "UPDATE",
                    description: descriptionChanged ? news.description : undefined,
                    dataExtraDimensions: dimensionsChanged
                        ? news.dataExtraDimensions
                        : undefined,
                })
                    .pipe(inFleetWiseRegion);
            }
            // 3b. Approve a waiting campaign when requested.
            if (news.autoApprove === true &&
                observed.status === "WAITING_FOR_APPROVAL") {
                yield* iotfleetwise
                    .updateCampaign({ name, action: "APPROVE" })
                    .pipe(inFleetWiseRegion);
            }
            // 3c. Sync tags against OBSERVED cloud tags.
            const arn = observed.arn;
            if (arn !== undefined) {
                yield* syncFleetWiseTags(arn, desiredTags);
            }
            observed = yield* waitUntilSettled(name);
            yield* session.note(name);
            return yield* toAttrs(observed);
        }),
        delete: Effect.fn(function* ({ output }) {
            // Deleting a campaign suspends data collection and removes it
            // from vehicles; deleting a missing campaign is success.
            yield* iotfleetwise
                .deleteCampaign({ name: output.campaignName })
                .pipe(inFleetWiseRegion, Effect.catchTag("ResourceNotFoundException", () => Effect.void));
        }),
        list: () => iotfleetwise.listCampaigns.items({}).pipe(Stream.runCollect, Effect.map((chunk) => Array.from(chunk).flatMap((summary) => summary.name !== undefined && summary.arn !== undefined
            ? [
                {
                    campaignName: summary.name,
                    campaignArn: summary.arn,
                    status: summary.status ?? "CREATING",
                    signalCatalogArn: summary.signalCatalogArn,
                    targetArn: summary.targetArn,
                },
            ]
            : [])), inFleetWiseRegion),
    };
}));
//# sourceMappingURL=Campaign.js.map