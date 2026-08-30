import * as zeroTrust from "@distilled.cloud/cloudflare/zero-trust";
import * as crypto from "node:crypto";
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
 * A Cloudflare Zero Trust Access bookmark application — an unprotected link
 * shown in the App Launcher.
 * @deprecated **Legacy resource.** Cloudflare has deprecated the dedicated
 * bookmarks API in favor of Access applications with `type: "bookmark"` —
 * prefer {@link Application} for new configurations. This resource is
 * provided for managing pre-existing bookmark records.
 *
 * ### Creating a Bookmark
 * **Example:** Basic bookmark
 * ```typescript
 * const bookmark = yield* Cloudflare.Access.Bookmark("Wiki", {
 *   domain: "wiki.example.com",
 * });
 * ```
 *
 * **Example:** Bookmark with a logo, hidden from the App Launcher
 * ```typescript
 * const bookmark = yield* Cloudflare.Access.Bookmark("Wiki", {
 *   name: "internal-wiki",
 *   domain: "wiki.example.com",
 *   logoUrl: "https://example.com/logo.png",
 *   appLauncherVisible: false,
 * });
 * ```
 *
 * ### Preferred Alternative
 * **Example:** Bookmark-type Access application (non-legacy)
 * ```typescript
 * const app = yield* Cloudflare.Access.Application("Wiki", {
 *   type: "bookmark",
 *   domain: "wiki.example.com",
 * });
 * ```
 *
 * @resource
 * @product Access
 * @category Cloudflare One (Zero Trust)
 */
export const Bookmark = Resource("Cloudflare.Access.Bookmark");
export const isBookmark = (value) => Predicate.hasProperty(value, "Type") &&
    value.Type === "Cloudflare.Access.Bookmark";
export const BookmarkProvider = () => Provider.succeed(Bookmark, {
    stables: ["bookmarkId", "accountId"],
    diff: Effect.fn(function* ({ news, output }) {
        const { accountId } = yield* yield* CloudflareEnvironment;
        if (!isResolved(news))
            return undefined;
        if ((output?.accountId ?? accountId) !== accountId) {
            return { action: "replace" };
        }
        // name/domain/logoUrl/appLauncherVisible converge via PUT.
    }),
    read: Effect.fn(function* ({ id, output, olds }) {
        const { accountId } = yield* yield* CloudflareEnvironment;
        const acct = output?.accountId ?? accountId;
        if (output?.bookmarkId) {
            const direct = yield* getBookmark(acct, output.bookmarkId);
            if (direct && direct.id)
                return toAttrs(direct, acct);
        }
        const name = yield* createBookmarkName(id, output?.name ?? olds?.name);
        const existing = yield* findBookmarkByName(acct, name);
        if (!existing || !existing.id)
            return undefined;
        return toAttrs(existing, acct);
    }),
    reconcile: Effect.fn(function* ({ id, news, output }) {
        const { accountId } = yield* yield* CloudflareEnvironment;
        const acct = output?.accountId ?? accountId;
        const name = yield* createBookmarkName(id, news.name);
        const desiredVisible = news.appLauncherVisible ?? true;
        // Observe — prefer the cached id, fall back to a name lookup so we
        // recover from out-of-band deletes and state-persistence failures.
        let observed;
        if (output?.bookmarkId) {
            observed = yield* getBookmark(acct, output.bookmarkId);
        }
        if (!observed || !observed.id) {
            observed = yield* findBookmarkByName(acct, name);
        }
        // Ensure — create when missing. The legacy API requires the new
        // bookmark's UUID in the path, so derive a deterministic one from the
        // name: a retry after a partial failure converges on the same record.
        if (!observed || !observed.id) {
            const bookmarkId = yield* deterministicUuid(`${acct}:${name}`);
            const created = yield* zeroTrust
                .createAccessBookmark({
                accountId: acct,
                bookmarkId,
                name,
                domain: news.domain,
                logoUrl: news.logoUrl,
                appLauncherVisible: desiredVisible,
            })
                .pipe(Effect.catch((err) => Effect.gen(function* () {
                const existing = yield* getBookmark(acct, bookmarkId);
                if (existing && existing.id)
                    return existing;
                return yield* Effect.fail(err);
            })));
            if (!created.id) {
                return yield* Effect.fail(new Error("Bookmark: created bookmark missing id"));
            }
            return toAttrs(created, acct);
        }
        // Sync — PUT the full desired shape only on a real delta.
        if (observed.name !== name ||
            observed.domain !== news.domain ||
            (observed.logoUrl ?? undefined) !== news.logoUrl ||
            (observed.appLauncherVisible ?? true) !== desiredVisible) {
            const updated = yield* zeroTrust.updateAccessBookmark({
                accountId: acct,
                bookmarkId: observed.id,
                name,
                domain: news.domain,
                logoUrl: news.logoUrl,
                appLauncherVisible: desiredVisible,
            });
            observed = {
                id: updated.id ?? observed.id,
                name: updated.name ?? name,
                domain: updated.domain ?? news.domain,
                logoUrl: updated.logoUrl ?? news.logoUrl,
                appLauncherVisible: updated.appLauncherVisible ?? desiredVisible,
            };
        }
        return toAttrs(observed, acct);
    }),
    delete: Effect.fn(function* ({ output }) {
        yield* zeroTrust
            .deleteAccessBookmark({
            accountId: output.accountId,
            bookmarkId: output.bookmarkId,
        })
            .pipe(Effect.catchTag("AccessBookmarkNotFound", () => Effect.void));
    }),
    list: Effect.fn(function* () {
        const { accountId } = yield* yield* CloudflareEnvironment;
        return yield* zeroTrust.listAccessBookmarks.pages({ accountId }).pipe(Stream.runCollect, Effect.map((chunk) => Array.from(chunk).flatMap((page) => (page.result ?? [])
            .filter((b) => Predicate.isNotNullish(b.id))
            .map((b) => toAttrs(b, accountId)))));
    }),
});
const createBookmarkName = (id, name) => Effect.gen(function* () {
    if (name)
        return name;
    return yield* createPhysicalName({ id });
});
const getBookmark = (acct, bookmarkId) => zeroTrust
    .getAccessBookmark({ accountId: acct, bookmarkId })
    .pipe(Effect.catchTag("AccessBookmarkNotFound", () => Effect.succeed(undefined)));
const findBookmarkByName = (acct, name) => zeroTrust.listAccessBookmarks.items({ accountId: acct }).pipe(Stream.filter((b) => b.name === name), Stream.runHead, Effect.map(Option.getOrUndefined), Effect.catch(() => Effect.succeed(undefined)));
/** RFC-4122-shaped v4 UUID derived deterministically from a seed string. */
const deterministicUuid = (seed) => Effect.sync(() => {
    const hex = crypto.createHash("sha256").update(seed).digest("hex");
    const bytes = hex.slice(0, 32).split("");
    bytes[12] = "4";
    bytes[16] = ((parseInt(bytes[16], 16) & 0x3) | 0x8).toString(16);
    const s = bytes.join("");
    return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20, 32)}`;
});
const toAttrs = (observed, accountId) => ({
    bookmarkId: observed.id,
    accountId,
    name: observed.name ?? "",
    domain: observed.domain ?? "",
    logoUrl: observed.logoUrl ?? undefined,
    appLauncherVisible: observed.appLauncherVisible ?? true,
});
//# sourceMappingURL=Bookmark.js.map