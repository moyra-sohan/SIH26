import * as ag from "@distilled.cloud/aws/api-gateway";
import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";
import { isResolved } from "../../Diff.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
const normalizeBasePath = (basePath) => basePath === undefined || basePath === "" ? "(none)" : basePath;
/**
 * Maps a custom domain name path to a REST API stage.
 *
 * ### Custom domain
 * **Example:** Root mapping
 * ```typescript
 * yield* ApiGateway.BasePathMapping("Root", {
 *   domainName: domain.domainName,
 *   restApiId: api.restApiId,
 *   stage: stage.stageName,
 * });
 * ```
 */
const BasePathMappingResource = Resource("AWS.ApiGateway.BasePathMapping");
export { BasePathMappingResource as BasePathMapping };
export const BasePathMappingProvider = () => Provider.effect(BasePathMappingResource, Effect.gen(function* () {
    return {
        stables: ["domainName", "domainNameId", "basePath"],
        diff: Effect.fn(function* ({ news: newsIn, olds }) {
            if (!isResolved(newsIn))
                return;
            const news = newsIn;
            if (news.domainName !== olds.domainName ||
                normalizeBasePath(news.basePath) !==
                    normalizeBasePath(olds.basePath)) {
                return { action: "replace" };
            }
        }),
        read: Effect.fn(function* ({ output }) {
            if (!output)
                return undefined;
            const b = yield* ag
                .getBasePathMapping({
                domainName: output.domainName,
                basePath: output.basePath,
                domainNameId: output.domainNameId,
            })
                .pipe(Effect.catchTag("NotFoundException", () => Effect.succeed(undefined)));
            if (!b?.restApiId)
                return undefined;
            return {
                domainName: output.domainName,
                basePath: output.basePath,
                domainNameId: output.domainNameId,
                restApiId: b.restApiId,
                stage: b.stage,
            };
        }),
        reconcile: Effect.fn(function* ({ news: newsIn, output, session }) {
            if (!isResolved(newsIn)) {
                return yield* Effect.die("BasePathMapping props were not resolved");
            }
            const news = newsIn;
            const domainName = output?.domainName ?? news.domainName;
            const domainNameId = output?.domainNameId ?? news.domainNameId;
            const basePath = output?.basePath ?? normalizeBasePath(news.basePath);
            // Observe — basePathmappings are keyed by (domainName, basePath).
            // We never trust `output.restApiId`/`output.stage` for diffing; we
            // re-read the live mapping every time.
            let observed = yield* ag
                .getBasePathMapping({
                domainName,
                basePath,
                domainNameId,
            })
                .pipe(Effect.catchTag("NotFoundException", () => Effect.succeed(undefined)));
            // Ensure — create the mapping if it isn't there.
            if (!observed?.restApiId) {
                yield* ag.createBasePathMapping({
                    domainName: news.domainName,
                    domainNameId: news.domainNameId,
                    basePath: basePath === "(none)" ? undefined : news.basePath,
                    restApiId: news.restApiId,
                    stage: news.stage,
                });
                yield* session.note(`Created base path mapping ${news.domainName} / ${basePath}`);
                observed = yield* ag.getBasePathMapping({
                    domainName,
                    basePath,
                    domainNameId,
                });
            }
            // Sync mutable fields — diff observed cloud state against desired.
            const desiredRestApiId = news.restApiId;
            const patches = [];
            if (desiredRestApiId !== observed.restApiId) {
                patches.push({
                    op: "replace",
                    path: "/restApiId",
                    value: desiredRestApiId,
                });
            }
            if ((news.stage ?? "") !== (observed.stage ?? "")) {
                patches.push({
                    op: "replace",
                    path: "/stage",
                    value: news.stage ?? "",
                });
            }
            if (patches.length > 0) {
                yield* ag.updateBasePathMapping({
                    domainName,
                    basePath,
                    domainNameId,
                    patchOperations: patches,
                });
            }
            yield* session.note(`Reconciled base path mapping`);
            const final = yield* ag.getBasePathMapping({
                domainName,
                basePath,
                domainNameId,
            });
            return {
                domainName,
                domainNameId,
                basePath,
                restApiId: final.restApiId,
                stage: final.stage,
            };
        }),
        // BasePathMappings are sub-resources keyed by their parent domain
        // name. There is no account-wide list, so enumerate every custom
        // domain name first (getDomainNames) and then list the mappings under
        // each (getBasePathMappings), flattening to the full Attributes shape.
        list: () => Effect.gen(function* () {
            const domains = yield* ag.getDomainNames.pages({}).pipe(Stream.runCollect, Effect.map((chunk) => Array.from(chunk).flatMap((page) => (page.items ?? []).filter((d) => d.domainName != null))));
            const rows = yield* Effect.forEach(domains, (domain) => ag.getBasePathMappings
                .pages({
                domainName: domain.domainName,
                domainNameId: domain.domainNameId,
            })
                .pipe(Stream.runCollect, Effect.map((chunk) => Array.from(chunk).flatMap((page) => (page.items ?? [])
                .filter((m) => m.restApiId != null)
                .map((m) => ({
                domainName: domain.domainName,
                domainNameId: domain.domainNameId,
                basePath: normalizeBasePath(m.basePath),
                restApiId: m.restApiId,
                stage: m.stage,
            })))), 
            // A domain can disappear between enumeration and listing.
            Effect.catchTag("NotFoundException", () => Effect.succeed([]))), { concurrency: 10 });
            return rows.flat();
        }),
        delete: Effect.fn(function* ({ output, session }) {
            yield* ag
                .deleteBasePathMapping({
                domainName: output.domainName,
                basePath: output.basePath,
                domainNameId: output.domainNameId,
            })
                .pipe(Effect.catchTag("NotFoundException", () => Effect.void));
            yield* session.note(`Deleted base path mapping`);
        }),
    };
}));
//# sourceMappingURL=BasePathMapping.js.map