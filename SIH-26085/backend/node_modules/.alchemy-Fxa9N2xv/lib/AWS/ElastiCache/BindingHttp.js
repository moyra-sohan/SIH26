import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import * as Output from "../../Output.js";
import { isBindingHost } from "../Lambda/Function.js";
/**
 * Shared scaffolding for AWS ElastiCache HTTP bindings.
 *
 * NOT exported from `index.ts` — every `{Op}Http.ts` in this service is a
 * thin `Layer.effect(Cap, make…HttpBinding({ … }))` over one of the builders
 * below. Everything except the operation and the IAM action list is
 * boilerplate. The env-only `ConnectHttp` binding stays bespoke — it attaches
 * environment variables instead of IAM policy.
 */
/**
 * Serverless cache snapshot ARNs embed the snapshot name, which is runtime
 * data for every snapshot-addressed operation, so snapshot-scoped grants use
 * this wildcard.
 */
export const SERVERLESS_SNAPSHOT_ARN_WILDCARD = "arn:aws:elasticache:*:*:serverlesscachesnapshot:*";
/**
 * Build the impl Effect for an account-level operation (snapshot management,
 * cache/event monitoring). The deploy-time half grants `actions` on
 * `resources` (default `*`) — these operations address caches and snapshots
 * by names that are runtime data.
 */
export const makeElastiCacheAccountHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* () {
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}())`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: [...(options.resources ?? ["*"])],
                        },
                    ],
                });
            }
        }
        return Effect.fn(options.tag)(function* (request) {
            return yield* op((request ?? {}));
        });
    });
});
/**
 * Build the impl Effect for a cache-scoped operation: the runtime callable
 * injects the bound {@link ServerlessCache}'s name as `ServerlessCacheName`
 * and the deploy-time half grants `actions` on the cache ARN (plus any
 * `extraResources`).
 */
export const makeElastiCacheCacheHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (cache) {
        const ServerlessCacheName = yield* cache.serverlessCacheName;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${cache}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: [
                                Output.interpolate `${cache.serverlessCacheArn}`,
                                ...(options.extraResources ?? []),
                            ],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${cache.LogicalId})`)(function* (request) {
            return yield* op({
                ...request,
                ServerlessCacheName: yield* ServerlessCacheName,
            });
        });
    });
});
//# sourceMappingURL=BindingHttp.js.map