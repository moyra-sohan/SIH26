import * as eventbridge from "@distilled.cloud/aws/eventbridge";
import * as Effect from "effect/Effect";
import * as Schedule from "effect/Schedule";
import { isResolved } from "../../Diff.js";
import { createPhysicalName } from "../../PhysicalName.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
export const Connection = Resource("AWS.EventBridge.Connection");
const toCreateAuthParameters = (auth) => ({
    ApiKeyAuthParameters: auth.apiKeyAuthParameters
        ? {
            ApiKeyName: auth.apiKeyAuthParameters.apiKeyName,
            ApiKeyValue: auth.apiKeyAuthParameters.apiKeyValue,
        }
        : undefined,
    BasicAuthParameters: auth.basicAuthParameters
        ? {
            Username: auth.basicAuthParameters.username,
            Password: auth.basicAuthParameters.password,
        }
        : undefined,
    OAuthParameters: auth.oauthParameters
        ? {
            ClientParameters: {
                ClientID: auth.oauthParameters.clientParameters.clientId,
                ClientSecret: auth.oauthParameters.clientParameters.clientSecret,
            },
            AuthorizationEndpoint: auth.oauthParameters.authorizationEndpoint,
            HttpMethod: auth.oauthParameters.httpMethod,
            OAuthHttpParameters: auth.oauthParameters.oauthHttpParameters,
        }
        : undefined,
    InvocationHttpParameters: auth.invocationHttpParameters,
});
export const ConnectionProvider = () => Provider.effect(Connection, Effect.gen(function* () {
    const createConnectionName = (id, props = {}) => props.name
        ? Effect.succeed(props.name)
        : createPhysicalName({
            id,
            maxLength: 64,
        });
    /**
     * Poll until the connection settles out of its transitional state
     * (CREATING/UPDATING/AUTHORIZING). API-key and basic connections
     * authorize in seconds; the wait is bounded so a slow OAuth handshake
     * surfaces the last observed state instead of hanging.
     */
    const awaitSettled = (name) => eventbridge.describeConnection({ Name: name }).pipe(
    // A describe fired immediately after create can be eventually
    // consistent — absorb NotFound briefly before polling the state.
    Effect.retry({
        while: (e) => e._tag === "ResourceNotFoundException",
        schedule: Schedule.spaced("1 second"),
        times: 5,
    }), Effect.repeat({
        schedule: Schedule.spaced("2 seconds"),
        until: (r) => r.ConnectionState !== "CREATING" &&
            r.ConnectionState !== "UPDATING" &&
            r.ConnectionState !== "AUTHORIZING",
        times: 15,
    }));
    return {
        stables: ["connectionName", "connectionArn"],
        diff: Effect.fn(function* ({ id, news, olds }) {
            if (!isResolved(news))
                return;
            const oldName = yield* createConnectionName(id, olds);
            const newName = yield* createConnectionName(id, news);
            if (oldName !== newName) {
                return { action: "replace" };
            }
        }),
        read: Effect.fn(function* ({ id, olds, output }) {
            // Connections don't support tags; the deterministic physical name
            // is the ownership signal (it embeds app/stage/logical id).
            const connectionName = output?.connectionName ??
                (yield* createConnectionName(id, olds ?? {}));
            const described = yield* eventbridge
                .describeConnection({ Name: connectionName })
                .pipe(Effect.catchTag("ResourceNotFoundException", () => Effect.succeed(undefined)));
            if (!described?.Name || !described.ConnectionArn) {
                return undefined;
            }
            return {
                connectionName: described.Name,
                connectionArn: described.ConnectionArn,
                connectionState: described.ConnectionState ?? "AUTHORIZED",
                secretArn: described.SecretArn,
            };
        }),
        list: () => Effect.gen(function* () {
            const attrs = [];
            let nextToken;
            do {
                const page = yield* eventbridge.listConnections({
                    NextToken: nextToken,
                });
                for (const connection of page.Connections ?? []) {
                    if (!connection.Name || !connection.ConnectionArn) {
                        continue;
                    }
                    attrs.push({
                        connectionName: connection.Name,
                        connectionArn: connection.ConnectionArn,
                        connectionState: connection.ConnectionState ?? "AUTHORIZED",
                    });
                }
                nextToken = page.NextToken;
            } while (nextToken);
            return attrs;
        }),
        reconcile: Effect.fn(function* ({ id, news, output, session }) {
            const connectionName = output?.connectionName ?? (yield* createConnectionName(id, news));
            // Observe — live cloud state is authoritative; a vanished
            // connection falls through to create.
            const observed = yield* eventbridge
                .describeConnection({ Name: connectionName })
                .pipe(Effect.catchTag("ResourceNotFoundException", () => Effect.succeed(undefined)));
            if (!observed?.ConnectionArn) {
                // Ensure — create the connection; tolerate an AlreadyExists race
                // with a peer reconciler and converge via the update below.
                yield* eventbridge
                    .createConnection({
                    Name: connectionName,
                    Description: news.description,
                    AuthorizationType: news.authorizationType,
                    AuthParameters: toCreateAuthParameters(news.authParameters),
                    KmsKeyIdentifier: news.kmsKeyIdentifier,
                })
                    .pipe(Effect.catchTag("ResourceAlreadyExistsException", () => Effect.void));
            }
            else {
                // Sync — updateConnection overwrites description, authorization
                // type/parameters, and KMS key in one shot. The update-parameter
                // shape is structurally compatible with the create shape (all
                // fields optional).
                yield* eventbridge.updateConnection({
                    Name: connectionName,
                    Description: news.description,
                    AuthorizationType: news.authorizationType,
                    AuthParameters: toCreateAuthParameters(news.authParameters),
                    KmsKeyIdentifier: news.kmsKeyIdentifier,
                });
            }
            const settled = yield* awaitSettled(connectionName);
            const connectionArn = (settled.ConnectionArn ??
                observed?.ConnectionArn);
            yield* session.note(connectionArn);
            return {
                connectionName,
                connectionArn,
                connectionState: settled.ConnectionState ?? "AUTHORIZED",
                secretArn: settled.SecretArn,
            };
        }),
        delete: Effect.fn(function* ({ output }) {
            // Deleting a connection that ApiDestinations still reference fails
            // until the destinations are gone; the engine deletes dependents
            // first, so a bounded retry absorbs eventual consistency.
            yield* eventbridge
                .deleteConnection({ Name: output.connectionName })
                .pipe(Effect.retry({
                while: (e) => e._tag === "ConcurrentModificationException",
                schedule: Schedule.spaced("2 seconds"),
                times: 8,
            }), Effect.catchTag("ResourceNotFoundException", () => Effect.void));
        }),
    };
}));
//# sourceMappingURL=Connection.js.map