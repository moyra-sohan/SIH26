import * as rolesanywhere from "@distilled.cloud/aws/rolesanywhere";
import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";
import { Unowned } from "../../AdoptPolicy.js";
import { isResolved } from "../../Diff.js";
import { createPhysicalName } from "../../PhysicalName.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
import { createInternalTags, hasAlchemyTags } from "../../Tags.js";
import { readRolesAnywhereTags, syncRolesAnywhereTags, toWireTags, } from "./internal.js";
/**
 * An IAM Roles Anywhere certificate revocation list (CRL). A CRL is a
 * PEM-encoded list of certificates revoked by the trust anchor's certificate
 * authority; IAM Roles Anywhere refuses to vend credentials for revoked
 * certificates while the CRL is enabled.
 * ### Importing a CRL
 * **Example:** CRL for a Trust Anchor
 * ```typescript
 * const anchor = yield* RolesAnywhere.TrustAnchor("Anchor", {
 *   certificateBundle: CA_CERTIFICATE_PEM,
 * });
 * const crl = yield* RolesAnywhere.Crl("Crl", {
 *   crlData: CRL_PEM,
 *   trustAnchorArn: anchor.trustAnchorArn,
 * });
 * ```
 *
 * ### Rotating the CRL
 * **Example:** Updated Revocation Data
 * ```typescript
 * const crl = yield* RolesAnywhere.Crl("Crl", {
 *   crlData: NEXT_CRL_PEM, // re-deploy with the CA's latest CRL
 *   trustAnchorArn: anchor.trustAnchorArn,
 * });
 * ```
 *
 * @resource
 */
export const Crl = Resource("AWS.RolesAnywhere.Crl");
const toAttrs = (detail) => ({
    crlId: detail.crlId,
    crlArn: detail.crlArn,
    crlName: detail.name,
    trustAnchorArn: detail.trustAnchorArn,
    enabled: detail.enabled ?? false,
});
const decodeCrlData = (data) => data === undefined ? undefined : new TextDecoder().decode(data);
export const CrlProvider = () => Provider.effect(Crl, Effect.gen(function* () {
    const createName = Effect.fn(function* (id, props) {
        return (props.crlName ?? (yield* createPhysicalName({ id, maxLength: 255 })));
    });
    /** Find a CRL by its user-facing name across all pages. */
    const findByName = (name) => rolesanywhere.listCrls.items({}).pipe(Stream.filter((detail) => detail.name === name), Stream.runHead, Effect.map((head) => (head._tag === "Some" ? head.value : undefined)));
    const getById = (crlId) => rolesanywhere.getCrl({ crlId }).pipe(Effect.map((r) => r.crl), Effect.catchTag("ResourceNotFoundException", () => Effect.succeed(undefined)));
    return {
        stables: ["crlId", "crlArn"],
        diff: Effect.fn(function* ({ olds, news }) {
            if (!isResolved(news))
                return undefined;
            // updateCrl only accepts name + crlData — the trust anchor
            // association is immutable, so a change forces a replacement.
            if (olds?.trustAnchorArn !== undefined &&
                olds.trustAnchorArn !== news.trustAnchorArn) {
                return { action: "replace" };
            }
        }),
        read: Effect.fn(function* ({ id, olds, output }) {
            const found = output?.crlId
                ? yield* getById(output.crlId)
                : yield* findByName(yield* createName(id, olds ?? {}));
            if (found === undefined)
                return undefined;
            const attrs = toAttrs(found);
            const tags = yield* readRolesAnywhereTags(attrs.crlArn);
            return (yield* hasAlchemyTags(id, tags)) ? attrs : Unowned(attrs);
        }),
        reconcile: Effect.fn(function* ({ id, news, output, session }) {
            const name = output?.crlName ?? (yield* createName(id, news));
            const internalTags = yield* createInternalTags(id);
            const desiredTags = { ...internalTags, ...news.tags };
            const desiredEnabled = news.enabled ?? true;
            const desiredPem = news.crlData.trim();
            const encodePem = Effect.sync(() => new TextEncoder().encode(desiredPem));
            // 1. Observe — cloud state is authoritative; output caches the id.
            let live = output?.crlId
                ? yield* getById(output.crlId)
                : yield* findByName(name);
            // 2. Ensure — import if missing.
            if (live === undefined) {
                const imported = yield* rolesanywhere.importCrl({
                    name,
                    crlData: yield* encodePem,
                    trustAnchorArn: news.trustAnchorArn,
                    enabled: desiredEnabled,
                    tags: toWireTags(desiredTags),
                });
                live = imported.crl;
            }
            else {
                // 3. Sync — converge name and revocation data.
                const desiredName = news.crlName ?? live.name;
                const observedPem = decodeCrlData(live.crlData)?.trim();
                if (live.name !== desiredName || observedPem !== desiredPem) {
                    const updated = yield* rolesanywhere.updateCrl({
                        crlId: live.crlId,
                        name: desiredName,
                        crlData: yield* encodePem,
                    });
                    live = updated.crl;
                }
            }
            if ((live.enabled ?? false) !== desiredEnabled) {
                // The enable/disable response can echo the pre-toggle state — the
                // successful call itself is authoritative for the flag.
                yield* desiredEnabled
                    ? rolesanywhere.enableCrl({ crlId: live.crlId })
                    : rolesanywhere.disableCrl({ crlId: live.crlId });
                live = { ...live, enabled: desiredEnabled };
            }
            // 3b. Sync tags against observed cloud tags.
            yield* syncRolesAnywhereTags(live.crlArn, desiredTags);
            yield* session.note(live.crlId);
            return toAttrs(live);
        }),
        delete: Effect.fn(function* ({ output }) {
            yield* rolesanywhere
                .deleteCrl({ crlId: output.crlId })
                .pipe(Effect.catchTag("ResourceNotFoundException", () => Effect.void));
        }),
        list: () => rolesanywhere.listCrls.items({}).pipe(Stream.map(toAttrs), Stream.runCollect, Effect.map((chunk) => Array.from(chunk))),
    };
}));
//# sourceMappingURL=Crl.js.map