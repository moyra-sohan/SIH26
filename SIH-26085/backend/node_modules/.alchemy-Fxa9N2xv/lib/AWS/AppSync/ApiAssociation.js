import * as appsync from "@distilled.cloud/aws/appsync";
import * as Effect from "effect/Effect";
import * as Schedule from "effect/Schedule";
import { isResolved } from "../../Diff.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
import { retryConcurrentModification } from "./common.js";
/**
 * Associates a GraphQL API with a custom {@link DomainName}
 * (existence-only resource — a domain serves exactly one API).
 * ### Associating an API
 * **Example:** Serve an API at a custom domain
 * ```typescript
 * yield* AppSync.ApiAssociation("Assoc", { domain, api });
 * ```
 *
 * @resource
 */
export const ApiAssociationResource = Resource("AWS.AppSync.ApiAssociation");
/**
 * User-facing wrapper for the ApiAssociation resource. Accepts the
 * `DomainName` and `GraphqlApi` resources directly.
 */
export const ApiAssociation = (id, props) => Effect.gen(function* () {
    const domainName = props.domainName ?? props.domain?.domainName;
    const apiId = props.apiId ?? props.api?.apiId;
    if (!domainName || !apiId) {
        return yield* Effect.die("ApiAssociation requires `domain`/`domainName` and `api`/`apiId`.");
    }
    return yield* ApiAssociationResource(id, { domainName, apiId });
});
export const ApiAssociationProvider = () => Provider.effect(ApiAssociationResource, Effect.gen(function* () {
    const getAssociationSafe = (domainName) => appsync.getApiAssociation({ domainName }).pipe(Effect.map((response) => response.apiAssociation), Effect.catchTag("NotFoundException", () => Effect.succeed(undefined)));
    /** Associations transition PROCESSING → SUCCESS/FAILED (~seconds). */
    const waitForSettled = (domainName) => getAssociationSafe(domainName).pipe(Effect.repeat({
        schedule: Schedule.fixed("2 seconds"),
        until: (association) => association === undefined ||
            association.associationStatus !== "PROCESSING",
        times: 30,
    }));
    return ApiAssociationResource.Provider.of({
        stables: ["domainName", "apiId"],
        // Sub-resource keyed entirely by its custom domain (domainName) with no global
        // enumeration API of its own — nuke reaches it through the parent's
        // deletion, so enumeration returns empty per the ProviderService
        // doctrine.
        list: () => Effect.succeed([]),
        read: Effect.fn(function* ({ olds, output }) {
            const domainName = output?.domainName ?? olds?.domainName;
            if (domainName === undefined)
                return undefined;
            const association = yield* getAssociationSafe(domainName);
            if (association?.apiId == null)
                return undefined;
            return { domainName, apiId: association.apiId };
        }),
        diff: Effect.fn(function* ({ news, olds }) {
            if (!isResolved(news))
                return undefined;
            if (news.domainName !== olds.domainName ||
                news.apiId !== olds.apiId) {
                return { action: "replace" };
            }
        }),
        reconcile: Effect.fn(function* ({ news, session }) {
            // Existence-only: observe → associate when missing or pointing
            // at a different API (associateApi is an upsert per domain).
            const observed = yield* getAssociationSafe(news.domainName);
            if (observed?.apiId !== news.apiId) {
                yield* retryConcurrentModification(appsync.associateApi({
                    domainName: news.domainName,
                    apiId: news.apiId,
                }));
                yield* waitForSettled(news.domainName);
                yield* session.note(`Associated ${news.apiId} with ${news.domainName}`);
            }
            return { domainName: news.domainName, apiId: news.apiId };
        }),
        delete: Effect.fn(function* ({ output }) {
            yield* retryConcurrentModification(appsync
                .disassociateApi({ domainName: output.domainName })
                .pipe(Effect.catchTag("NotFoundException", () => Effect.void)));
            // Wait until the association is gone so a dependent DomainName
            // delete doesn't race the detach (bounded ~60s).
            yield* getAssociationSafe(output.domainName).pipe(Effect.repeat({
                schedule: Schedule.fixed("2 seconds"),
                until: (association) => association?.apiId == null,
                times: 30,
            }));
        }),
    });
}));
//# sourceMappingURL=ApiAssociation.js.map