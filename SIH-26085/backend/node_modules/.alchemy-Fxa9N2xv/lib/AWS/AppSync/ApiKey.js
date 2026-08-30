import * as appsync from "@distilled.cloud/aws/appsync";
import * as Effect from "effect/Effect";
import * as Redacted from "effect/Redacted";
import * as Stream from "effect/Stream";
import { isResolved } from "../../Diff.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
import { retryConcurrentModification } from "./common.js";
/**
 * An AppSync API key for `API_KEY`-authenticated GraphQL APIs.
 *
 * The key's `id` attribute is the secret value (`da2-…`) sent in the
 * `x-api-key` request header. It is wrapped in `Redacted`; unwrap with
 * `Redacted.value(key.id)` where the raw header value is needed.
 * ### Creating API Keys
 * **Example:** Key with the default 7-day expiry
 * ```typescript
 * const key = yield* AppSync.ApiKey("Key", { api });
 * // Redacted.value(key.id) → "da2-…" — send as the x-api-key header
 * ```
 *
 * **Example:** Key with a managed expiry
 * ```typescript
 * const key = yield* AppSync.ApiKey("Key", {
 *   api,
 *   description: "mobile clients",
 *   expires: 1893456000, // rounded down to the hour by AWS
 * });
 * ```
 *
 * @resource
 */
export const ApiKeyResource = Resource("AWS.AppSync.ApiKey");
/**
 * User-facing wrapper for the ApiKey resource. Accepts `api: GraphqlApi`
 * as the idiomatic way to mint a key for an API.
 */
export const ApiKey = (id, props = {}) => Effect.gen(function* () {
    const { api, ...rest } = props;
    const apiId = rest.apiId ?? api?.apiId;
    if (!apiId) {
        return yield* Effect.die("ApiKey requires either `api` (preferred) or an explicit `apiId`.");
    }
    return yield* ApiKeyResource(id, { ...rest, apiId });
});
/** AWS rounds key expiry down to the nearest hour. */
const floorToHour = (epochSeconds) => Math.floor(epochSeconds / 3600) * 3600;
export const ApiKeyProvider = () => Provider.effect(ApiKeyResource, Effect.gen(function* () {
    /** Find a key by its ID (keys have no other stable identity). */
    const findKey = Effect.fn(function* (apiId, keyId) {
        const pages = yield* appsync.listApiKeys.pages({ apiId }).pipe(Stream.runCollect, Effect.catchTag("NotFoundException", () => Effect.succeed([])));
        return Array.from(pages)
            .flatMap((page) => page.apiKeys ?? [])
            .find((key) => key.id === keyId);
    });
    const toAttributes = (apiId, key) => ({
        apiId,
        // The key id doubles as the secret `x-api-key` header value.
        id: Redacted.make(key.id),
        expires: key.expires,
        description: key.description,
    });
    return ApiKeyResource.Provider.of({
        stables: ["apiId", "id"],
        // Sub-resource keyed entirely by its GraphQL API (apiId) with no global
        // enumeration API of its own — nuke reaches it through the parent's
        // deletion, so enumeration returns empty per the ProviderService
        // doctrine.
        list: () => Effect.succeed([]),
        read: Effect.fn(function* ({ output }) {
            // Keys carry no deterministic identity — without the cached id
            // there is nothing to look up (a fresh reconcile will mint one).
            if (output?.id === undefined)
                return undefined;
            const key = yield* findKey(output.apiId, Redacted.value(output.id));
            if (key?.id == null)
                return undefined;
            return toAttributes(output.apiId, key);
        }),
        diff: Effect.fn(function* ({ news, olds }) {
            if (!isResolved(news))
                return undefined;
            if (news.apiId !== olds.apiId) {
                return { action: "replace" };
            }
            // description/expires converge via updateApiKey
        }),
        reconcile: Effect.fn(function* ({ news, output, session }) {
            const apiId = output?.apiId ?? news.apiId;
            // 1. OBSERVE — the cached key id is the only handle.
            let observed = output?.id !== undefined
                ? yield* findKey(apiId, Redacted.value(output.id))
                : undefined;
            if (observed?.id == null) {
                // 2. ENSURE
                const created = yield* retryConcurrentModification(appsync.createApiKey({
                    apiId,
                    description: news.description,
                    expires: news.expires,
                }));
                observed = created.apiKey;
                yield* session.note(`Created API key for ${apiId}`);
            }
            else {
                // 3. SYNC — update description/expiry on drift (expiry only
                //    when managed by props; AWS floors it to the hour).
                const expiresDrifted = news.expires !== undefined &&
                    observed.expires !== floorToHour(news.expires);
                const descriptionDrifted = news.description !== undefined &&
                    observed.description !== news.description;
                if (expiresDrifted || descriptionDrifted) {
                    const updated = yield* retryConcurrentModification(appsync.updateApiKey({
                        apiId,
                        id: observed.id,
                        description: news.description,
                        expires: news.expires,
                    }));
                    observed = updated.apiKey ?? observed;
                    yield* session.note(`Updated API key ${observed.id}`);
                }
            }
            return toAttributes(apiId, observed);
        }),
        delete: Effect.fn(function* ({ output }) {
            yield* retryConcurrentModification(appsync
                .deleteApiKey({
                apiId: output.apiId,
                id: Redacted.value(output.id),
            })
                .pipe(Effect.catchTag("NotFoundException", () => Effect.void)));
        }),
    });
}));
//# sourceMappingURL=ApiKey.js.map