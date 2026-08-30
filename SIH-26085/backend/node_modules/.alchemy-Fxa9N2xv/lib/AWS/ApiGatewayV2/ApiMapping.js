import * as agw2 from "@distilled.cloud/aws/apigatewayv2";
import * as Effect from "effect/Effect";
import { isResolved } from "../../Diff.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
import { collectAllPages, retryOnTooManyRequests } from "./common.js";
/**
 * An API Gateway v2 API mapping — serves an API stage under a custom
 * {@link DomainName}, optionally at a base path.
 * ### Mapping APIs onto a domain
 * **Example:** Map an API at the domain root
 * ```typescript
 * yield* ApiGatewayV2.ApiMapping("Root", {
 *   api,
 *   domainName: domain.domainName,
 *   stage: stage.stageName,
 * });
 * ```
 *
 * **Example:** Map a second API under /v2
 * ```typescript
 * yield* ApiGatewayV2.ApiMapping("V2", {
 *   api: apiV2,
 *   domainName: domain.domainName,
 *   stage: "$default",
 *   apiMappingKey: "v2",
 * });
 * ```
 *
 * @resource
 */
export const ApiMappingResource = Resource("AWS.ApiGatewayV2.ApiMapping");
/**
 * User-facing wrapper for the ApiMapping resource. Accepts `api: Api` as
 * the idiomatic way to map an API onto a domain.
 */
export const ApiMapping = (id, props) => Effect.gen(function* () {
    const { api, ...rest } = props;
    const apiId = rest.apiId ?? api?.apiId;
    if (!apiId) {
        return yield* Effect.die("ApiMapping requires either `api` (preferred) or an explicit `apiId`.");
    }
    return yield* ApiMappingResource(id, { ...rest, apiId });
});
const snapshotFromMapping = (domainName, mapping) => ({
    apiMappingId: mapping.ApiMappingId,
    apiId: mapping.ApiId ?? "",
    domainName,
    stage: mapping.Stage ?? "",
    apiMappingKey: mapping.ApiMappingKey === "" ? undefined : mapping.ApiMappingKey,
});
export const ApiMappingProvider = () => Provider.effect(ApiMappingResource, Effect.gen(function* () {
    const getMappingSafe = (domainName, apiMappingId) => agw2
        .getApiMapping({ DomainName: domainName, ApiMappingId: apiMappingId })
        .pipe(Effect.catchTag("NotFoundException", () => Effect.succeed(undefined)));
    return ApiMappingResource.Provider.of({
        stables: ["apiMappingId", "domainName"],
        list: () => Effect.gen(function* () {
            const domains = yield* collectAllPages((NextToken) => agw2.getDomainNames({ NextToken }));
            const perDomain = yield* Effect.forEach(domains.filter((domain) => domain.DomainName != null), (domain) => collectAllPages((NextToken) => agw2.getApiMappings({
                DomainName: domain.DomainName,
                NextToken,
            })).pipe(Effect.map((items) => items
                .filter((mapping) => mapping.ApiMappingId != null)
                .map((mapping) => snapshotFromMapping(domain.DomainName, mapping))), Effect.catchTag("NotFoundException", () => Effect.succeed([]))), { concurrency: 5 });
            return perDomain.flat();
        }),
        read: Effect.fn(function* ({ output }) {
            if (!output?.domainName || !output.apiMappingId)
                return undefined;
            const mapping = yield* getMappingSafe(output.domainName, output.apiMappingId);
            if (!mapping?.ApiMappingId)
                return undefined;
            return snapshotFromMapping(output.domainName, mapping);
        }),
        diff: Effect.fn(function* ({ news, olds }) {
            if (!isResolved(news))
                return undefined;
            if (news.domainName !== olds.domainName) {
                return { action: "replace" };
            }
        }),
        reconcile: Effect.fn(function* ({ news, output, session }) {
            const domainName = output?.domainName ?? news.domainName;
            // 1. OBSERVE
            let observed = output?.apiMappingId
                ? yield* getMappingSafe(domainName, output.apiMappingId)
                : undefined;
            // 2. ENSURE
            if (!observed?.ApiMappingId) {
                observed = yield* retryOnTooManyRequests(agw2.createApiMapping({
                    DomainName: domainName,
                    ApiId: news.apiId,
                    Stage: news.stage,
                    ApiMappingKey: news.apiMappingKey,
                }));
                yield* session.note(`Created API mapping ${observed.ApiMappingId}`);
                return snapshotFromMapping(domainName, observed);
            }
            // 3. SYNC
            const snapshot = snapshotFromMapping(domainName, observed);
            const drift = snapshot.apiId !== news.apiId ||
                snapshot.stage !== news.stage ||
                snapshot.apiMappingKey !== news.apiMappingKey;
            if (drift) {
                yield* retryOnTooManyRequests(agw2.updateApiMapping({
                    DomainName: domainName,
                    ApiMappingId: snapshot.apiMappingId,
                    ApiId: news.apiId,
                    Stage: news.stage,
                    ApiMappingKey: news.apiMappingKey,
                }));
                yield* session.note(`Updated API mapping ${snapshot.apiMappingId}`);
                const final = yield* agw2.getApiMapping({
                    DomainName: domainName,
                    ApiMappingId: snapshot.apiMappingId,
                });
                return snapshotFromMapping(domainName, final);
            }
            return snapshot;
        }),
        delete: Effect.fn(function* ({ output, session }) {
            yield* retryOnTooManyRequests(agw2
                .deleteApiMapping({
                DomainName: output.domainName,
                ApiMappingId: output.apiMappingId,
            })
                .pipe(Effect.catchTag("NotFoundException", () => Effect.void)));
            yield* session.note(`Deleted API mapping ${output.apiMappingId}`);
        }),
    });
}));
//# sourceMappingURL=ApiMapping.js.map