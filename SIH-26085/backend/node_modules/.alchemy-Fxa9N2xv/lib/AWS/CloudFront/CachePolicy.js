import * as cloudfront from "@distilled.cloud/aws/cloudfront";
import * as Effect from "effect/Effect";
import { isResolved } from "../../Diff.js";
import { toWireSeconds } from "../../Util/Duration.js";
import { createPhysicalName } from "../../PhysicalName.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
/**
 * A CloudFront cache policy.
 *
 * Cache policies determine the values CloudFront includes in the cache key,
 * the headers, cookies and query strings it forwards to the origin, and the
 * TTL bounds for cached responses. Policies are referenced by ID on a
 * Distribution's default behavior or per-path cache behaviors.
 *
 * For AWS-managed policies (CachingOptimized, CachingDisabled,
 * AllViewerExceptHostHeader) reference them by ID via the constants in
 * {@link ManagedPolicies} instead of creating a custom policy.
 * ### Creating Cache Policies
 * **Example:** Cache by query string and Authorization header
 * ```typescript
 * const cachePolicy = yield* CachePolicy("ApiCachePolicy", {
 *   comment: "Cache GETs by query string + Authorization",
 *   minTTL: 0,
 *   defaultTTL: "1 minute",
 *   maxTTL: "1 hour",
 *   parametersInCacheKeyAndForwardedToOrigin: {
 *     EnableAcceptEncodingGzip: true,
 *     EnableAcceptEncodingBrotli: true,
 *     HeadersConfig: {
 *       HeaderBehavior: "whitelist",
 *       Headers: { Quantity: 1, Items: ["Authorization"] },
 *     },
 *     CookiesConfig: { CookieBehavior: "none" },
 *     QueryStringsConfig: { QueryStringBehavior: "all" },
 *   },
 * });
 * ```
 *
 * @resource
 */
export const CachePolicy = Resource("AWS.CloudFront.CachePolicy");
export const CachePolicyProvider = () => Provider.effect(CachePolicy, Effect.gen(function* () {
    const getById = Effect.fn(function* (id) {
        const config = yield* cloudfront
            .getCachePolicyConfig({ Id: id })
            .pipe(Effect.catchTag("NoSuchCachePolicy", () => Effect.succeed(undefined)));
        if (!config?.CachePolicyConfig)
            return undefined;
        return { config: config.CachePolicyConfig, etag: config.ETag };
    });
    const getByName = Effect.fn(function* (name) {
        const listed = yield* cloudfront.listCachePolicies({ Type: "custom" });
        const summary = listed.CachePolicyList?.Items?.find((item) => item.CachePolicy?.CachePolicyConfig?.Name === name);
        if (!summary?.CachePolicy?.Id)
            return undefined;
        return yield* getById(summary.CachePolicy.Id).pipe(Effect.map((found) => found ? { id: summary.CachePolicy.Id, ...found } : undefined));
    });
    const buildConfig = (name, props) => ({
        Name: name,
        Comment: props.comment,
        MinTTL: toWireSeconds(props.minTTL),
        DefaultTTL: toWireSeconds(props.defaultTTL),
        MaxTTL: toWireSeconds(props.maxTTL),
        ParametersInCacheKeyAndForwardedToOrigin: props.parametersInCacheKeyAndForwardedToOrigin,
    });
    const toAttrs = (id, config, etag) => ({
        cachePolicyId: id,
        name: config.Name,
        etag,
        comment: config.Comment,
        minTTL: config.MinTTL,
        defaultTTL: config.DefaultTTL,
        maxTTL: config.MaxTTL,
        parametersInCacheKeyAndForwardedToOrigin: config.ParametersInCacheKeyAndForwardedToOrigin,
    });
    return {
        stables: ["cachePolicyId"],
        diff: Effect.fn(function* ({ id, news, olds }) {
            if (!isResolved(news))
                return undefined;
            if ((yield* createName(id, olds ?? {})) !==
                (yield* createName(id, news))) {
                return { action: "replace" };
            }
        }),
        read: Effect.fn(function* ({ id, olds, output }) {
            if (output?.cachePolicyId) {
                const found = yield* getById(output.cachePolicyId);
                if (found)
                    return toAttrs(output.cachePolicyId, found.config, found.etag);
            }
            const name = yield* createName(id, olds ?? {});
            const found = yield* getByName(name);
            if (!found)
                return undefined;
            return toAttrs(found.id, found.config, found.etag);
        }),
        // CloudFront is global (no region). `listCachePolicies` returns both
        // AWS-managed and custom policies; we filter to `Type: "custom"` since
        // those are the only ones we create/delete. The op is marker-paginated
        // (no `.pages`), so we loop until `NextMarker` is exhausted and hydrate
        // each summary's ETag via `getById` so every row matches read().
        list: () => Effect.gen(function* () {
            const items = [];
            let marker = undefined;
            do {
                const listed = yield* cloudfront.listCachePolicies({
                    Type: "custom",
                    Marker: marker,
                });
                for (const summary of listed.CachePolicyList?.Items ?? []) {
                    if (summary.Type !== "custom")
                        continue;
                    const id = summary.CachePolicy?.Id;
                    const config = summary.CachePolicy?.CachePolicyConfig;
                    if (!id || !config)
                        continue;
                    const found = yield* getById(id);
                    items.push(toAttrs(id, found?.config ?? config, found?.etag));
                }
                marker = listed.CachePolicyList?.NextMarker;
            } while (marker);
            return items;
        }),
        reconcile: Effect.fn(function* ({ id, news, output, session }) {
            const name = yield* createName(id, news);
            // Observe — locate the policy by id (cached on `output`) or by
            // name. Trust observed cloud state, not stale `olds`.
            let observed = output?.cachePolicyId
                ? yield* getById(output.cachePolicyId).pipe(Effect.map((found) => found ? { id: output.cachePolicyId, ...found } : undefined))
                : undefined;
            if (!observed) {
                observed = yield* getByName(name);
            }
            // Ensure — create the policy if it's missing. Tolerate
            // `CachePolicyAlreadyExists` as a race with a peer reconciler:
            // re-read by name and continue with the sync path.
            if (!observed) {
                const created = yield* cloudfront
                    .createCachePolicy({
                    CachePolicyConfig: buildConfig(name, news),
                })
                    .pipe(Effect.catchTag("CachePolicyAlreadyExists", () => getByName(name).pipe(Effect.flatMap((existing) => existing
                    ? Effect.succeed({
                        CachePolicy: {
                            Id: existing.id,
                            LastModifiedTime: new Date(),
                            CachePolicyConfig: existing.config,
                        },
                        ETag: existing.etag,
                        Location: undefined,
                    })
                    : Effect.fail(new Error(`Cache policy '${name}' already exists but could not be recovered`))))));
                if (!created.CachePolicy?.Id) {
                    return yield* Effect.fail(new Error("createCachePolicy returned no identifier"));
                }
                yield* session.note(created.CachePolicy.Id);
                return toAttrs(created.CachePolicy.Id, created.CachePolicy.CachePolicyConfig, created.ETag);
            }
            // Sync — diff observed config against desired and patch via
            // `updateCachePolicy` with the freshly observed ETag.
            const desired = buildConfig(observed.config.Name, news);
            const updated = yield* cloudfront.updateCachePolicy({
                Id: observed.id,
                IfMatch: observed.etag,
                CachePolicyConfig: desired,
            });
            if (!updated.CachePolicy?.Id) {
                return yield* Effect.fail(new Error("updateCachePolicy returned no identifier"));
            }
            yield* session.note(observed.id);
            return toAttrs(updated.CachePolicy.Id, updated.CachePolicy.CachePolicyConfig, updated.ETag);
        }),
        delete: Effect.fn(function* ({ output }) {
            const current = yield* getById(output.cachePolicyId);
            if (!current)
                return;
            yield* cloudfront
                .deleteCachePolicy({
                Id: output.cachePolicyId,
                IfMatch: current.etag,
            })
                .pipe(Effect.catchTag("NoSuchCachePolicy", () => Effect.void));
        }),
    };
}));
const createName = (id, props) => props.name
    ? Effect.succeed(props.name)
    : createPhysicalName({ id, maxLength: 128, lowercase: true });
//# sourceMappingURL=CachePolicy.js.map