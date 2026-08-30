import * as mediapackagev2 from "@distilled.cloud/aws/mediapackagev2";
import * as Effect from "effect/Effect";
import * as Predicate from "effect/Predicate";
import { Unowned } from "../../AdoptPolicy.js";
import { isResolved } from "../../Diff.js";
import { createPhysicalName } from "../../PhysicalName.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
import { createInternalTags, hasAlchemyTags } from "../../Tags.js";
import { deleteChannelWithEndpoints, listAllChannelGroups, listGroupChannels, matchesDesired, policiesEqual, syncMpTags, toMpTagRecord, } from "./internal.js";
/**
 * An AWS Elemental MediaPackage v2 channel — the entry point for live
 * content into MediaPackage. An encoder (such as AWS Elemental MediaLive)
 * pushes an HLS or CMAF stream to the channel's ingest endpoints; origin
 * endpoints then package and serve that content downstream.
 *
 * ### Creating a Channel
 * **Example:** Basic Channel in a Group
 * ```typescript
 * import * as MediaPackageV2 from "alchemy/AWS/MediaPackageV2";
 *
 * const group = yield* MediaPackageV2.ChannelGroup("Live");
 * const channel = yield* MediaPackageV2.Channel("Feed", {
 *   channelGroupName: group.channelGroupName,
 * });
 * ```
 *
 * **Example:** CMAF Ingest Channel
 * ```typescript
 * const channel = yield* MediaPackageV2.Channel("Feed", {
 *   channelGroupName: group.channelGroupName,
 *   inputType: "CMAF",
 *   description: "CMAF contribution feed",
 * });
 * ```
 *
 * ### Resource Policy
 * **Example:** Allow a Principal to Push Content
 * ```typescript
 * const channel = yield* MediaPackageV2.Channel("Feed", {
 *   channelGroupName: group.channelGroupName,
 *   policy: JSON.stringify({
 *     Version: "2012-10-17",
 *     Statement: [{
 *       Effect: "Allow",
 *       Principal: { AWS: "arn:aws:iam::111122223333:root" },
 *       Action: "mediapackagev2:PutObject",
 *       Resource: "arn:aws:mediapackagev2:us-east-1:111122223333:channelGroup/live/channel/feed",
 *     }],
 *   }),
 * });
 * ```
 *
 * ### Ingest Endpoints
 * **Example:** Point the encoder at the ingest URLs
 * ```typescript
 * const channel = yield* MediaPackageV2.Channel("Feed", {
 *   channelGroupName: group.channelGroupName,
 * });
 * // Two redundant ingest endpoints for the encoder to push to.
 * const urls = channel.ingestEndpoints;
 * ```
 *
 * @resource
 */
export const Channel = Resource("AWS.MediaPackageV2.Channel");
export const ChannelProvider = () => Provider.effect(Channel, Effect.gen(function* () {
    const createName = Effect.fn(function* (id, props) {
        return (props.channelName ??
            (yield* createPhysicalName({ id, maxLength: 256 })));
    });
    const toAttrs = (channel) => ({
        channelGroupName: channel.ChannelGroupName,
        channelName: channel.ChannelName,
        channelArn: channel.Arn,
        inputType: channel.InputType,
        ingestEndpoints: (channel.IngestEndpoints ?? []).map((endpoint) => ({
            id: endpoint.Id,
            url: endpoint.Url,
        })),
    });
    /** Get a channel by group + name; typed not-found → undefined. */
    const getChannel = Effect.fn(function* (channelGroupName, channelName) {
        return yield* mediapackagev2
            .getChannel({
            ChannelGroupName: channelGroupName,
            ChannelName: channelName,
        })
            .pipe(Effect.catchTag("ResourceNotFoundException", () => Effect.succeed(undefined)));
    });
    return {
        stables: ["channelGroupName", "channelName", "channelArn"],
        diff: Effect.fn(function* ({ id, olds, news }) {
            if (!isResolved(news))
                return undefined;
            // Group, name, and input type are the channel's identity.
            if (olds.channelGroupName !== news.channelGroupName) {
                return { action: "replace" };
            }
            const oldName = yield* createName(id, olds);
            const newName = yield* createName(id, news);
            if (oldName !== newName)
                return { action: "replace" };
            if ((olds.inputType ?? "HLS") !== (news.inputType ?? "HLS")) {
                return { action: "replace" };
            }
        }),
        read: Effect.fn(function* ({ id, olds, output }) {
            const channelGroupName = output?.channelGroupName ?? olds?.channelGroupName;
            if (channelGroupName === undefined)
                return undefined;
            const channelName = output?.channelName ?? (yield* createName(id, olds ?? {}));
            const channel = yield* getChannel(channelGroupName, channelName);
            if (channel === undefined)
                return undefined;
            const attrs = toAttrs(channel);
            return (yield* hasAlchemyTags(id, toMpTagRecord(channel.Tags)))
                ? attrs
                : Unowned(attrs);
        }),
        reconcile: Effect.fn(function* ({ id, news, output, session }) {
            const internalTags = yield* createInternalTags(id);
            const desiredTags = { ...internalTags, ...news.tags };
            const channelGroupName = news.channelGroupName;
            const channelName = output?.channelName ?? (yield* createName(id, news));
            // 1. Observe — cloud state is authoritative; output is an id cache.
            let channel = yield* getChannel(channelGroupName, channelName);
            // 2. Ensure — create if missing; a Conflict means a peer created it
            //    concurrently, so fall through to observing the winner.
            if (channel === undefined) {
                channel = yield* mediapackagev2
                    .createChannel({
                    ChannelGroupName: channelGroupName,
                    ChannelName: channelName,
                    InputType: news.inputType,
                    Description: news.description,
                    InputSwitchConfiguration: news.inputSwitchConfiguration,
                    OutputHeaderConfiguration: news.outputHeaderConfiguration,
                    Tags: desiredTags,
                })
                    .pipe(Effect.catchTag("ConflictException", () => mediapackagev2.getChannel({
                    ChannelGroupName: channelGroupName,
                    ChannelName: channelName,
                })));
            }
            else {
                // 3. Sync — apply the mutable fields only when the observed
                //    state has drifted from the desired state.
                const desired = {
                    Description: news.description ?? "",
                    InputSwitchConfiguration: news.inputSwitchConfiguration,
                    OutputHeaderConfiguration: news.outputHeaderConfiguration,
                };
                const observed = {
                    Description: channel.Description ?? "",
                    InputSwitchConfiguration: channel.InputSwitchConfiguration,
                    OutputHeaderConfiguration: channel.OutputHeaderConfiguration,
                };
                if (!matchesDesired(desired, observed)) {
                    channel = yield* mediapackagev2.updateChannel({
                        ChannelGroupName: channelGroupName,
                        ChannelName: channelName,
                        Description: news.description,
                        InputSwitchConfiguration: news.inputSwitchConfiguration,
                        OutputHeaderConfiguration: news.outputHeaderConfiguration,
                    });
                }
            }
            // 3b. Sync tags — diff against OBSERVED cloud tags.
            yield* syncMpTags(channel.Arn, toMpTagRecord(channel.Tags), desiredTags);
            // 3c. Sync the resource policy — observe the live policy (absent
            //     policy is the typed not-found) and apply only the delta.
            const observedPolicy = yield* mediapackagev2
                .getChannelPolicy({
                ChannelGroupName: channelGroupName,
                ChannelName: channelName,
            })
                .pipe(Effect.map((response) => response.Policy), Effect.catchTag("ResourceNotFoundException", () => Effect.succeed(undefined)));
            if (news.policy !== undefined) {
                if (!policiesEqual(observedPolicy, news.policy)) {
                    yield* mediapackagev2.putChannelPolicy({
                        ChannelGroupName: channelGroupName,
                        ChannelName: channelName,
                        Policy: news.policy,
                    });
                }
            }
            else if (observedPolicy !== undefined) {
                yield* mediapackagev2.deleteChannelPolicy({
                    ChannelGroupName: channelGroupName,
                    ChannelName: channelName,
                });
            }
            yield* session.note(channelName);
            return toAttrs(channel);
        }),
        delete: Effect.fn(function* ({ output }) {
            // Reap the channel's origin endpoints first (a normal stack destroy
            // already deleted them; an orphan sweep may not have), then delete
            // the channel. Every step is idempotent and the transient Conflict
            // while just-deleted endpoints are cleaned up is retried.
            yield* deleteChannelWithEndpoints(output.channelGroupName, output.channelName);
        }),
        // Channels are keyed by their parent channel group, so enumerate
        // the groups first and fan out.
        list: () => Effect.gen(function* () {
            const groups = yield* listAllChannelGroups();
            const items = yield* Effect.forEach(groups, (group) => listGroupChannels(group.ChannelGroupName), { concurrency: 5 }).pipe(Effect.map((nested) => nested.flat()));
            // The list shape omits ingest endpoints, so hydrate each item
            // via get; a channel can vanish between enumeration and
            // hydration.
            const channels = yield* Effect.forEach(items, (item) => getChannel(item.ChannelGroupName, item.ChannelName).pipe(Effect.map((channel) => channel === undefined ? undefined : toAttrs(channel))), { concurrency: 5 });
            return channels.filter(Predicate.isNotUndefined);
        }),
    };
}));
//# sourceMappingURL=Channel.js.map