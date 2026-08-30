import * as zeroTrust from "@distilled.cloud/cloudflare/zero-trust";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Predicate from "effect/Predicate";
import * as Stream from "effect/Stream";
import { isResolved } from "../../Diff.js";
import { createPhysicalName } from "../../PhysicalName.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
import { CloudflareEnvironment } from "../CloudflareEnvironment.js";
/**
 * A Cloudflare Zero Trust Access custom page. Replaces the default Access
 * block pages (`identity_denied` / `forbidden`) with custom HTML, which can
 * then be selected on an Access application.
 * ### Creating a Custom Page
 * **Example:** Custom forbidden page
 * ```typescript
 * const page = yield* Cloudflare.Access.CustomPage("Forbidden", {
 *   type: "forbidden",
 *   customHtml: "<html><body><h1>Access denied</h1></body></html>",
 * });
 * ```
 *
 * **Example:** Custom identity-denied page with an explicit name
 * ```typescript
 * const page = yield* Cloudflare.Access.CustomPage("Denied", {
 *   name: "corp-identity-denied",
 *   type: "identity_denied",
 *   customHtml: "<html><body><h1>Who are you?</h1></body></html>",
 * });
 * ```
 *
 * ### Updating the HTML
 * **Example:** HTML and name converge in place
 * ```typescript
 * const page = yield* Cloudflare.Access.CustomPage("Forbidden", {
 *   type: "forbidden",
 *   customHtml: "<html><body><h1>Still denied</h1></body></html>",
 * });
 * ```
 *
 * @resource
 * @product Access
 * @category Cloudflare One (Zero Trust)
 */
export const CustomPage = Resource("Cloudflare.Access.CustomPage");
export const isCustomPage = (value) => Predicate.hasProperty(value, "Type") &&
    value.Type === "Cloudflare.Access.CustomPage";
export const CustomPageProvider = () => Provider.succeed(CustomPage, {
    stables: ["customPageId", "accountId", "type"],
    // Account-scoped collection (pattern b). The list response items already
    // carry every Attribute field (uid/name/type) — read's Attributes don't
    // include customHtml — so no per-item get is needed to match the read shape.
    list: Effect.fn(function* () {
        const { accountId } = yield* yield* CloudflareEnvironment;
        return yield* zeroTrust.listAccessCustomPages.pages({ accountId }).pipe(Stream.runCollect, Effect.map((chunk) => Array.from(chunk).flatMap((page) => (page.result ?? [])
            .filter((p) => p.uid != null)
            .map((p) => toAttrs(p, accountId)))));
    }),
    diff: Effect.fn(function* ({ news, output }) {
        const { accountId } = yield* yield* CloudflareEnvironment;
        if (!isResolved(news))
            return undefined;
        if ((output?.accountId ?? accountId) !== accountId) {
            return { action: "replace" };
        }
        // The page type cannot change in place.
        if (output && news.type !== output.type) {
            return { action: "replace" };
        }
        // name/customHtml converge via PUT.
    }),
    read: Effect.fn(function* ({ id, output, olds }) {
        const { accountId } = yield* yield* CloudflareEnvironment;
        const acct = output?.accountId ?? accountId;
        if (output?.customPageId) {
            const direct = yield* zeroTrust
                .getAccessCustomPage({
                accountId: acct,
                customPageId: output.customPageId,
            })
                .pipe(Effect.catchTag("AccessCustomPageNotFound", () => Effect.succeed(undefined)));
            if (direct && direct.uid) {
                return toAttrs(direct, acct);
            }
        }
        const name = yield* createPageName(id, olds?.name ?? output?.name);
        const existing = yield* findPageByName(acct, name);
        if (!existing || !existing.uid)
            return undefined;
        const full = yield* zeroTrust
            .getAccessCustomPage({ accountId: acct, customPageId: existing.uid })
            .pipe(Effect.catchTag("AccessCustomPageNotFound", () => Effect.succeed(undefined)));
        if (!full || !full.uid)
            return undefined;
        return toAttrs(full, acct);
    }),
    reconcile: Effect.fn(function* ({ id, news, output }) {
        const { accountId } = yield* yield* CloudflareEnvironment;
        const acct = output?.accountId ?? accountId;
        const name = yield* createPageName(id, news.name);
        // Observe — prefer the cached id, fall back to a name lookup so we
        // recover from out-of-band deletes and state-persistence failures.
        let observed;
        if (output?.customPageId) {
            observed = yield* zeroTrust
                .getAccessCustomPage({
                accountId: acct,
                customPageId: output.customPageId,
            })
                .pipe(Effect.catchTag("AccessCustomPageNotFound", () => Effect.succeed(undefined)));
        }
        if (!observed || !observed.uid) {
            const byName = yield* findPageByName(acct, name);
            if (byName?.uid) {
                observed = yield* zeroTrust
                    .getAccessCustomPage({ accountId: acct, customPageId: byName.uid })
                    .pipe(Effect.catchTag("AccessCustomPageNotFound", () => Effect.succeed(undefined)));
            }
        }
        // Ensure — create the page when missing. Tolerate a same-named create
        // race by re-observing.
        if (!observed || !observed.uid) {
            const created = yield* zeroTrust
                .createAccessCustomPage({
                accountId: acct,
                name,
                type: news.type,
                customHtml: news.customHtml,
            })
                .pipe(Effect.catch((err) => Effect.gen(function* () {
                const existing = yield* findPageByName(acct, name);
                if (existing && existing.uid)
                    return existing;
                return yield* Effect.fail(err);
            })));
            if (!created.uid) {
                return yield* Effect.fail(new Error("CustomPage: created page missing uid"));
            }
            return toAttrs({ ...created, type: news.type }, acct);
        }
        // Sync — converge name/html via PUT only on a real delta. The GET
        // returns the full customHtml so the comparison is observed-vs-desired.
        if (observed.name !== name ||
            observed.type !== news.type ||
            observed.customHtml !== news.customHtml) {
            const updated = yield* zeroTrust.updateAccessCustomPage({
                accountId: acct,
                customPageId: observed.uid,
                name,
                type: news.type,
                customHtml: news.customHtml,
            });
            observed = {
                uid: updated.uid ?? observed.uid,
                name: updated.name ?? name,
                type: updated.type ?? news.type,
            };
        }
        return toAttrs(observed, acct);
    }),
    delete: Effect.fn(function* ({ output }) {
        yield* zeroTrust
            .deleteAccessCustomPage({
            accountId: output.accountId,
            customPageId: output.customPageId,
        })
            .pipe(Effect.catchTag("AccessCustomPageNotFound", () => Effect.void));
    }),
});
const createPageName = (id, name) => Effect.gen(function* () {
    if (name)
        return name;
    return yield* createPhysicalName({ id });
});
const findPageByName = (acct, name) => zeroTrust.listAccessCustomPages.items({ accountId: acct }).pipe(Stream.filter((p) => p.name === name), Stream.runHead, Effect.map(Option.getOrUndefined), Effect.catch(() => Effect.succeed(undefined)));
const toAttrs = (observed, accountId) => ({
    customPageId: observed.uid,
    accountId,
    name: observed.name ?? "",
    type: (observed.type ?? "forbidden"),
});
//# sourceMappingURL=CustomPage.js.map