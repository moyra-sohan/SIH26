import * as agw2 from "@distilled.cloud/aws/apigatewayv2";
import * as Effect from "effect/Effect";
import { deepEqual, isResolved } from "../../Diff.js";
import { createPhysicalName } from "../../PhysicalName.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
import { createInternalTags } from "../../Tags.js";
import { AWSEnvironment } from "../Environment.js";
import { apiArn, collectAllPages, retryOnTooManyRequests, syncTags, tagRecord, } from "./common.js";
/**
 * An Amazon API Gateway v2 API — the root of an HTTP API or WebSocket API.
 *
 * HTTP APIs are the modern, cheaper, faster front door for Lambda functions
 * (compared to REST v1). WebSocket APIs provide two-way real-time messaging
 * backed by Lambda route handlers. Child resources (`Integration`, `Route`,
 * `Stage`, `Authorizer`) reference the API by passing `api` in their props.
 * ### HTTP APIs
 * For the common "HTTP API in front of a Lambda function" case, prefer the
 * high-level {@link HttpApi} helper which wires up the integration, route,
 * stage, and invoke permission in one call.
 *
 * **Example:** Minimal HTTP API
 * ```typescript
 * import * as ApiGatewayV2 from "alchemy/AWS/ApiGatewayV2";
 *
 * const api = yield* ApiGatewayV2.Api("Api", {});
 * ```
 *
 * **Example:** HTTP API with CORS
 * ```typescript
 * const api = yield* ApiGatewayV2.Api("Api", {
 *   corsConfiguration: {
 *     AllowOrigins: ["https://example.com"],
 *     AllowMethods: ["GET", "POST"],
 *     AllowHeaders: ["content-type"],
 *     MaxAge: 3600,
 *   },
 * });
 * ```
 *
 * ### WebSocket APIs
 * **Example:** WebSocket API
 * ```typescript
 * const api = yield* ApiGatewayV2.Api("WsApi", {
 *   protocolType: "WEBSOCKET",
 *   routeSelectionExpression: "$request.body.action",
 * });
 * ```
 *
 * ### Endpoint hardening
 * **Example:** Disable the default execute-api endpoint
 * ```typescript
 * const api = yield* ApiGatewayV2.Api("Api", {
 *   disableExecuteApiEndpoint: true,
 * });
 * ```
 *
 * @resource
 */
export const Api = Resource("AWS.ApiGatewayV2.Api");
const generatedName = (id, props) => props.name
    ? Effect.succeed(props.name)
    : createPhysicalName({ id, maxLength: 128 });
const defaultRouteSelectionExpression = (props) => props.routeSelectionExpression ??
    (props.protocolType === "WEBSOCKET" ? "$request.body.action" : undefined);
const snapshotFromApi = (api) => ({
    apiId: api.ApiId,
    apiEndpoint: api.ApiEndpoint ?? "",
    name: api.Name ?? "",
    protocolType: api.ProtocolType ?? "HTTP",
    routeSelectionExpression: api.RouteSelectionExpression,
    description: api.Description,
    apiKeySelectionExpression: api.ApiKeySelectionExpression,
    corsConfiguration: api.CorsConfiguration,
    disableExecuteApiEndpoint: api.DisableExecuteApiEndpoint,
    disableSchemaValidation: api.DisableSchemaValidation,
    ipAddressType: api.IpAddressType,
    version: api.Version,
    tags: tagRecord(api.Tags),
});
export const ApiProvider = () => Provider.effect(Api, Effect.gen(function* () {
    const getApiSafe = (apiId) => agw2
        .getApi({ ApiId: apiId })
        .pipe(Effect.catchTag("NotFoundException", () => Effect.succeed(undefined)));
    return Api.Provider.of({
        stables: ["apiId", "apiEndpoint"],
        list: () => Effect.gen(function* () {
            const items = yield* collectAllPages((NextToken) => agw2.getApis({ NextToken }));
            return items
                .filter((api) => api.ApiId != null)
                .map((api) => snapshotFromApi(api));
        }),
        read: Effect.fn(function* ({ output }) {
            if (!output?.apiId)
                return undefined;
            const api = yield* getApiSafe(output.apiId);
            if (!api?.ApiId)
                return undefined;
            return snapshotFromApi(api);
        }),
        diff: Effect.fn(function* ({ news, olds }) {
            if (!isResolved(news))
                return undefined;
            const oldProtocol = olds.protocolType ?? "HTTP";
            const newProtocol = news.protocolType ?? "HTTP";
            if (oldProtocol !== newProtocol) {
                return { action: "replace" };
            }
        }),
        reconcile: Effect.fn(function* ({ id, news, output, session }) {
            const { region } = yield* AWSEnvironment.current;
            const name = yield* generatedName(id, news);
            const internalTags = yield* createInternalTags(id);
            const desiredTags = { ...news.tags, ...internalTags };
            const routeSelectionExpression = defaultRouteSelectionExpression(news);
            // 1. OBSERVE — output is only a cache for the stable id; the
            //    cloud is authoritative.
            let observed = output?.apiId
                ? yield* getApiSafe(output.apiId)
                : undefined;
            // 2. ENSURE — create if missing (greenfield or deleted
            //    out-of-band).
            if (!observed?.ApiId) {
                observed = yield* retryOnTooManyRequests(agw2.createApi({
                    Name: name,
                    ProtocolType: news.protocolType ?? "HTTP",
                    Description: news.description,
                    RouteSelectionExpression: routeSelectionExpression,
                    ApiKeySelectionExpression: news.apiKeySelectionExpression,
                    CorsConfiguration: news.corsConfiguration,
                    DisableExecuteApiEndpoint: news.disableExecuteApiEndpoint,
                    DisableSchemaValidation: news.disableSchemaValidation,
                    IpAddressType: news.ipAddressType,
                    Version: news.version,
                    Tags: desiredTags,
                }));
                yield* session.note(`Created API ${observed.ApiId}`);
            }
            const apiId = observed.ApiId;
            const snapshot = snapshotFromApi(observed);
            // 3. SYNC — diff observed against desired per mutable aspect and
            //    apply only the delta.
            const drift = snapshot.name !== name ||
                snapshot.description !== news.description ||
                (routeSelectionExpression !== undefined &&
                    snapshot.routeSelectionExpression !== routeSelectionExpression) ||
                snapshot.apiKeySelectionExpression !==
                    news.apiKeySelectionExpression ||
                (news.corsConfiguration !== undefined &&
                    !deepEqual(snapshot.corsConfiguration, news.corsConfiguration)) ||
                (snapshot.disableExecuteApiEndpoint ?? false) !==
                    (news.disableExecuteApiEndpoint ?? false) ||
                (news.disableSchemaValidation !== undefined &&
                    snapshot.disableSchemaValidation !==
                        news.disableSchemaValidation) ||
                (news.ipAddressType !== undefined &&
                    snapshot.ipAddressType !== news.ipAddressType) ||
                snapshot.version !== news.version;
            if (drift) {
                yield* retryOnTooManyRequests(agw2.updateApi({
                    ApiId: apiId,
                    Name: name,
                    Description: news.description,
                    RouteSelectionExpression: routeSelectionExpression,
                    ApiKeySelectionExpression: news.apiKeySelectionExpression,
                    CorsConfiguration: news.corsConfiguration,
                    DisableExecuteApiEndpoint: news.disableExecuteApiEndpoint,
                    DisableSchemaValidation: news.disableSchemaValidation,
                    IpAddressType: news.ipAddressType,
                    Version: news.version,
                }));
            }
            // CORS removal is a separate API call — `updateApi` cannot clear
            // an existing configuration.
            if (news.corsConfiguration === undefined &&
                snapshot.corsConfiguration !== undefined) {
                yield* agw2
                    .deleteCorsConfiguration({ ApiId: apiId })
                    .pipe(Effect.catchTag("NotFoundException", () => Effect.void));
            }
            // 3b. SYNC TAGS — diff against OBSERVED cloud tags.
            if (!deepEqual(snapshot.tags, desiredTags)) {
                yield* syncTags({
                    resourceArn: apiArn(region, apiId),
                    oldTags: snapshot.tags,
                    newTags: desiredTags,
                });
            }
            // 4. RETURN — re-read so attributes reflect actual cloud state.
            const final = yield* agw2.getApi({ ApiId: apiId });
            yield* session.note(`Reconciled API ${apiId}`);
            return snapshotFromApi(final);
        }),
        delete: Effect.fn(function* ({ output, session }) {
            yield* retryOnTooManyRequests(agw2
                .deleteApi({ ApiId: output.apiId })
                .pipe(Effect.catchTag("NotFoundException", () => Effect.void)));
            yield* session.note(`Deleted API ${output.apiId}`);
        }),
    });
}));
//# sourceMappingURL=Api.js.map