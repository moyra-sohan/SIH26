import * as agw2 from "@distilled.cloud/aws/apigatewayv2";
import * as Effect from "effect/Effect";
import { deepEqual, isResolved } from "../../Diff.js";
import { createPhysicalName } from "../../PhysicalName.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
import { toWireSeconds } from "../../Util/Duration.js";
import { collectAllPages, retryOnTooManyRequests } from "./common.js";
/**
 * An API Gateway v2 Authorizer — controls access to HTTP/WebSocket API
 * routes via JWT validation or a Lambda (`REQUEST`) authorizer.
 * ### JWT authorizers
 * The common HTTP API authorizer: API Gateway validates the caller's JWT
 * against the issuer's JWKS and matches the audience — no Lambda invoked.
 *
 * **Example:** JWT authorizer for a Cognito user pool
 * ```typescript
 * const authorizer = yield* ApiGatewayV2.Authorizer("Jwt", {
 *   api,
 *   authorizerType: "JWT",
 *   identitySource: ["$request.header.Authorization"],
 *   jwtConfiguration: {
 *     Issuer: `https://cognito-idp.us-west-2.amazonaws.com/${userPoolId}`,
 *     Audience: [clientId],
 *   },
 * });
 *
 * yield* ApiGatewayV2.Route("Secure", {
 *   api,
 *   routeKey: "GET /me",
 *   integration,
 *   authorizationType: "JWT",
 *   authorizerId: authorizer.authorizerId,
 * });
 * ```
 *
 * ### Lambda (REQUEST) authorizers
 * **Example:** Simple-response Lambda authorizer
 * ```typescript
 * const authorizer = yield* ApiGatewayV2.Authorizer("Lambda", {
 *   api,
 *   authorizerType: "REQUEST",
 *   identitySource: ["$request.header.Authorization"],
 *   authorizerUri: invocationUri,
 *   authorizerPayloadFormatVersion: "2.0",
 *   enableSimpleResponses: true,
 * });
 * ```
 *
 * @resource
 */
export const AuthorizerResource = Resource("AWS.ApiGatewayV2.Authorizer");
/**
 * User-facing wrapper for the Authorizer resource. Accepts `api: Api` as
 * the idiomatic way to attach an authorizer to an API.
 */
export const Authorizer = (id, props) => Effect.gen(function* () {
    const { api, ...rest } = props;
    const apiId = rest.apiId ?? api?.apiId;
    if (!apiId) {
        return yield* Effect.die("Authorizer requires either `api` (preferred) or an explicit `apiId`.");
    }
    return yield* AuthorizerResource(id, { ...rest, apiId });
});
const snapshotFromAuthorizer = (apiId, auth) => ({
    apiId,
    authorizerId: auth.AuthorizerId,
    name: auth.Name ?? "",
    authorizerType: auth.AuthorizerType ?? "JWT",
    identitySource: auth.IdentitySource,
    jwtConfiguration: auth.JwtConfiguration,
    authorizerUri: auth.AuthorizerUri,
    authorizerPayloadFormatVersion: auth.AuthorizerPayloadFormatVersion,
    enableSimpleResponses: auth.EnableSimpleResponses,
    authorizerResultTtlInSeconds: auth.AuthorizerResultTtlInSeconds,
    authorizerCredentialsArn: auth.AuthorizerCredentialsArn,
    identityValidationExpression: auth.IdentityValidationExpression,
});
export const AuthorizerProvider = () => Provider.effect(AuthorizerResource, Effect.gen(function* () {
    const createName = Effect.fn(function* (id, props) {
        return (props.name ?? (yield* createPhysicalName({ id, maxLength: 128 })));
    });
    const getAuthorizerSafe = (apiId, authorizerId) => agw2
        .getAuthorizer({ ApiId: apiId, AuthorizerId: authorizerId })
        .pipe(Effect.catchTag("NotFoundException", () => Effect.succeed(undefined)));
    return AuthorizerResource.Provider.of({
        stables: ["apiId", "authorizerId"],
        list: () => Effect.gen(function* () {
            const apis = yield* collectAllPages((NextToken) => agw2.getApis({ NextToken }));
            const perApi = yield* Effect.forEach(apis.filter((api) => api.ApiId != null), (api) => collectAllPages((NextToken) => agw2.getAuthorizers({ ApiId: api.ApiId, NextToken })).pipe(Effect.map((items) => items
                .filter((auth) => auth.AuthorizerId != null)
                .map((auth) => snapshotFromAuthorizer(api.ApiId, auth))), Effect.catchTag("NotFoundException", () => Effect.succeed([]))), { concurrency: 5 });
            return perApi.flat();
        }),
        read: Effect.fn(function* ({ output }) {
            if (!output?.apiId || !output.authorizerId)
                return undefined;
            const auth = yield* getAuthorizerSafe(output.apiId, output.authorizerId);
            if (!auth?.AuthorizerId)
                return undefined;
            return snapshotFromAuthorizer(output.apiId, auth);
        }),
        diff: Effect.fn(function* ({ news, olds }) {
            if (!isResolved(news))
                return undefined;
            if (news.apiId !== olds.apiId) {
                return { action: "replace" };
            }
        }),
        reconcile: Effect.fn(function* ({ id, news, output, session }) {
            const apiId = output?.apiId ?? news.apiId;
            const name = yield* createName(id, news);
            // 1. OBSERVE
            let observed = output?.authorizerId
                ? yield* getAuthorizerSafe(apiId, output.authorizerId)
                : undefined;
            // 2. ENSURE
            if (!observed?.AuthorizerId) {
                observed = yield* retryOnTooManyRequests(agw2.createAuthorizer({
                    ApiId: apiId,
                    Name: name,
                    AuthorizerType: news.authorizerType,
                    IdentitySource: news.identitySource,
                    JwtConfiguration: news.jwtConfiguration,
                    AuthorizerUri: news.authorizerUri,
                    AuthorizerPayloadFormatVersion: news.authorizerPayloadFormatVersion,
                    EnableSimpleResponses: news.enableSimpleResponses,
                    AuthorizerResultTtlInSeconds: toWireSeconds(news.authorizerResultTtl),
                    AuthorizerCredentialsArn: news.authorizerCredentialsArn,
                    IdentityValidationExpression: news.identityValidationExpression,
                }));
                yield* session.note(`Created authorizer ${observed.AuthorizerId}`);
                return snapshotFromAuthorizer(apiId, observed);
            }
            // 3. SYNC — update on drift.
            const snapshot = snapshotFromAuthorizer(apiId, observed);
            const desiredTtlSeconds = toWireSeconds(news.authorizerResultTtl);
            const drift = snapshot.name !== name ||
                snapshot.authorizerType !== news.authorizerType ||
                (news.identitySource !== undefined &&
                    !deepEqual(snapshot.identitySource, news.identitySource)) ||
                (news.jwtConfiguration !== undefined &&
                    !deepEqual(snapshot.jwtConfiguration, news.jwtConfiguration)) ||
                snapshot.authorizerUri !== news.authorizerUri ||
                snapshot.authorizerPayloadFormatVersion !==
                    news.authorizerPayloadFormatVersion ||
                (news.enableSimpleResponses !== undefined &&
                    snapshot.enableSimpleResponses !== news.enableSimpleResponses) ||
                (desiredTtlSeconds !== undefined &&
                    snapshot.authorizerResultTtlInSeconds !== desiredTtlSeconds) ||
                snapshot.authorizerCredentialsArn !==
                    news.authorizerCredentialsArn ||
                snapshot.identityValidationExpression !==
                    news.identityValidationExpression;
            if (drift) {
                const updated = yield* retryOnTooManyRequests(agw2.updateAuthorizer({
                    ApiId: apiId,
                    AuthorizerId: snapshot.authorizerId,
                    Name: name,
                    AuthorizerType: news.authorizerType,
                    IdentitySource: news.identitySource,
                    JwtConfiguration: news.jwtConfiguration,
                    AuthorizerUri: news.authorizerUri,
                    AuthorizerPayloadFormatVersion: news.authorizerPayloadFormatVersion,
                    EnableSimpleResponses: news.enableSimpleResponses,
                    AuthorizerResultTtlInSeconds: desiredTtlSeconds,
                    AuthorizerCredentialsArn: news.authorizerCredentialsArn,
                    IdentityValidationExpression: news.identityValidationExpression,
                }));
                yield* session.note(`Updated authorizer ${snapshot.authorizerId}`);
                return snapshotFromAuthorizer(apiId, updated);
            }
            return snapshot;
        }),
        delete: Effect.fn(function* ({ output, session }) {
            yield* retryOnTooManyRequests(agw2
                .deleteAuthorizer({
                ApiId: output.apiId,
                AuthorizerId: output.authorizerId,
            })
                .pipe(Effect.catchTag("NotFoundException", () => Effect.void)));
            yield* session.note(`Deleted authorizer ${output.authorizerId}`);
        }),
    });
}));
//# sourceMappingURL=Authorizer.js.map