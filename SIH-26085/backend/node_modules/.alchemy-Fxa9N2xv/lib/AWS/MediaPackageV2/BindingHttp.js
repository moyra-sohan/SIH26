import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import * as Output from "../../Output.js";
import { isBindingHost } from "../Lambda/Function.js";
/**
 * Shared scaffolding for AWS Elemental MediaPackage v2 HTTP bindings.
 *
 * NOT exported from `index.ts` — every `{Op}Http.ts` in this service is a
 * thin `Layer.effect(Cap, make…HttpBinding({ … }))` over one of the three
 * builders below. Everything except the operation and the IAM action list
 * is boilerplate: each builder injects the bound resource's identifying
 * names (`ChannelGroupName` / `ChannelName` / `OriginEndpointName`) into
 * every request and grants `actions` on the resource's ARN.
 *
 * Harvest-job operations authorize against the *harvest job* ARN, which is
 * the origin endpoint ARN with a `/harvestJob/{name}` suffix — set
 * `harvestJobScoped` to grant on that pattern instead of the endpoint ARN.
 */
/**
 * Build the impl Effect for a MediaPackage v2 operation scoped to a
 * {@link ChannelGroup}: the runtime callable injects the group's
 * `ChannelGroupName` and the deploy-time half grants `actions` on the
 * group ARN (plus everything beneath it — channels, endpoints, harvest
 * jobs — for list operations that enumerate child resources).
 */
export const makeMediaPackageV2ChannelGroupHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (group) {
        const ChannelGroupName = yield* group.channelGroupName;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${group}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: [
                                Output.interpolate `${group.channelGroupArn}`,
                                Output.interpolate `${group.channelGroupArn}/*`,
                            ],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${group.LogicalId})`)(function* (request) {
            return yield* op({
                ...request,
                ChannelGroupName: yield* ChannelGroupName,
            });
        });
    });
});
/**
 * Build the impl Effect for a MediaPackage v2 operation scoped to a
 * {@link Channel}: the runtime callable injects the channel's
 * `ChannelGroupName` + `ChannelName` and the deploy-time half grants
 * `actions` on the channel ARN.
 */
export const makeMediaPackageV2ChannelHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (channel) {
        const ChannelGroupName = yield* channel.channelGroupName;
        const ChannelName = yield* channel.channelName;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${channel}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: [Output.interpolate `${channel.channelArn}`],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${channel.LogicalId})`)(function* (request) {
            return yield* op({
                ...request,
                ChannelGroupName: yield* ChannelGroupName,
                ChannelName: yield* ChannelName,
            });
        });
    });
});
/**
 * Build the impl Effect for a MediaPackage v2 operation scoped to an
 * {@link OriginEndpoint}: the runtime callable injects the endpoint's
 * `ChannelGroupName` + `ChannelName` + `OriginEndpointName` and the
 * deploy-time half grants `actions` on the endpoint ARN — plus, when
 * `harvestJobScoped` is set, on the endpoint's harvest-job ARN pattern
 * (`{endpointArn}/harvestJob/*`) and the parent channel-group ARN:
 * MediaPackage authorizes `CreateHarvestJob` against the bare channel
 * group (observed live: "not authorized to perform
 * mediapackagev2:CreateHarvestJob on resource: arn:…:channelGroup/{g}").
 */
export const makeMediaPackageV2OriginEndpointHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (endpoint) {
        const ChannelGroupName = yield* endpoint.channelGroupName;
        const ChannelName = yield* endpoint.channelName;
        const OriginEndpointName = yield* endpoint.originEndpointName;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${endpoint}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: [
                                Output.interpolate `${endpoint.originEndpointArn}`,
                                ...(options.harvestJobScoped
                                    ? [
                                        Output.interpolate `${endpoint.originEndpointArn}/harvestJob/*`,
                                        // The endpoint ARN is `…:channelGroup/{g}/channel/{c}/originEndpoint/{e}`;
                                        // harvest-job actions authorize against the bare
                                        // channel-group ARN prefix.
                                        Output.map(endpoint.originEndpointArn, (arn) => arn.split("/channel/")[0]),
                                    ]
                                    : []),
                            ],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${endpoint.LogicalId})`)(function* (request) {
            return yield* op({
                ...request,
                ChannelGroupName: yield* ChannelGroupName,
                ChannelName: yield* ChannelName,
                OriginEndpointName: yield* OriginEndpointName,
            });
        });
    });
});
//# sourceMappingURL=BindingHttp.js.map