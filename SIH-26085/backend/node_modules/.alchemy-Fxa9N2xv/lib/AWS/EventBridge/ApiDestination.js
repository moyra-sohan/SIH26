import * as eventbridge from "@distilled.cloud/aws/eventbridge";
import * as Effect from "effect/Effect";
import { isResolved } from "../../Diff.js";
import { createPhysicalName } from "../../PhysicalName.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
export const ApiDestination = Resource("AWS.EventBridge.ApiDestination");
export const ApiDestinationProvider = () => Provider.effect(ApiDestination, Effect.gen(function* () {
    const createDestinationName = (id, props = {}) => props.name
        ? Effect.succeed(props.name)
        : createPhysicalName({
            id,
            maxLength: 64,
        });
    return {
        stables: ["apiDestinationName", "apiDestinationArn"],
        diff: Effect.fn(function* ({ id, news, olds }) {
            if (!isResolved(news))
                return;
            const oldName = yield* createDestinationName(id, olds);
            const newName = yield* createDestinationName(id, news);
            if (oldName !== newName) {
                return { action: "replace" };
            }
        }),
        read: Effect.fn(function* ({ id, olds, output }) {
            // API destinations don't support tags; the deterministic physical
            // name is the ownership signal (it embeds app/stage/logical id).
            const name = output?.apiDestinationName ??
                (yield* createDestinationName(id, olds ?? {}));
            const described = yield* eventbridge
                .describeApiDestination({ Name: name })
                .pipe(Effect.catchTag("ResourceNotFoundException", () => Effect.succeed(undefined)));
            if (!described?.Name || !described.ApiDestinationArn) {
                return undefined;
            }
            return {
                apiDestinationName: described.Name,
                apiDestinationArn: described.ApiDestinationArn,
                apiDestinationState: described.ApiDestinationState ?? "ACTIVE",
            };
        }),
        list: () => Effect.gen(function* () {
            const attrs = [];
            let nextToken;
            do {
                const page = yield* eventbridge.listApiDestinations({
                    NextToken: nextToken,
                });
                for (const destination of page.ApiDestinations ?? []) {
                    if (!destination.Name || !destination.ApiDestinationArn) {
                        continue;
                    }
                    attrs.push({
                        apiDestinationName: destination.Name,
                        apiDestinationArn: destination.ApiDestinationArn,
                        apiDestinationState: destination.ApiDestinationState ?? "ACTIVE",
                    });
                }
                nextToken = page.NextToken;
            } while (nextToken);
            return attrs;
        }),
        reconcile: Effect.fn(function* ({ id, news, output, session }) {
            const name = output?.apiDestinationName ??
                (yield* createDestinationName(id, news));
            // Observe — live cloud state is authoritative; a vanished
            // destination falls through to create.
            const observed = yield* eventbridge
                .describeApiDestination({ Name: name })
                .pipe(Effect.catchTag("ResourceNotFoundException", () => Effect.succeed(undefined)));
            if (!observed?.ApiDestinationArn) {
                // Ensure — create the destination; tolerate an AlreadyExists
                // race with a peer reconciler and converge via the update below.
                yield* eventbridge
                    .createApiDestination({
                    Name: name,
                    Description: news.description,
                    ConnectionArn: news.connectionArn,
                    InvocationEndpoint: news.invocationEndpoint,
                    HttpMethod: news.httpMethod,
                    InvocationRateLimitPerSecond: news.invocationRateLimitPerSecond,
                })
                    .pipe(Effect.catchTag("ResourceAlreadyExistsException", () => Effect.void));
            }
            else {
                // Sync — updateApiDestination overwrites the mutable aspects
                // (description, connection, endpoint, method, rate limit) in one
                // shot (idempotent on matching values).
                yield* eventbridge.updateApiDestination({
                    Name: name,
                    Description: news.description,
                    ConnectionArn: news.connectionArn,
                    InvocationEndpoint: news.invocationEndpoint,
                    HttpMethod: news.httpMethod,
                    InvocationRateLimitPerSecond: news.invocationRateLimitPerSecond,
                });
            }
            const settled = yield* eventbridge.describeApiDestination({
                Name: name,
            });
            const apiDestinationArn = settled.ApiDestinationArn;
            yield* session.note(apiDestinationArn);
            return {
                apiDestinationName: name,
                apiDestinationArn,
                apiDestinationState: settled.ApiDestinationState ?? "ACTIVE",
            };
        }),
        delete: Effect.fn(function* ({ output }) {
            yield* eventbridge
                .deleteApiDestination({ Name: output.apiDestinationName })
                .pipe(Effect.catchTag("ResourceNotFoundException", () => Effect.void));
        }),
    };
}));
//# sourceMappingURL=ApiDestination.js.map