import * as emailSecurity from "@distilled.cloud/cloudflare/email-security";
import * as Effect from "effect/Effect";
import * as Predicate from "effect/Predicate";
import * as Stream from "effect/Stream";
import { Unowned } from "../../AdoptPolicy.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
import { CloudflareEnvironment } from "../CloudflareEnvironment.js";
const EmailSecurityBlockSenderTypeId = "Cloudflare.Email.BlockSender";
/**
 * A Cloudflare Email Security (Area 1) blocked sender — messages matching
 * the pattern are blocked before delivery.
 *
 * All fields are mutable in place. Requires the Email Security enterprise
 * add-on; accounts without the entitlement receive the typed
 * `EmailSecurityNotEntitled` error.
 * ### Blocking Senders
 * **Example:** Block a single email address
 * ```typescript
 * yield* Cloudflare.Email.BlockSender("KnownPhisher", {
 *   pattern: "phisher@malicious.example.com",
 *   patternType: "EMAIL",
 *   comments: "reported in incident 1234",
 * });
 * ```
 *
 * **Example:** Block a whole sending domain
 * ```typescript
 * yield* Cloudflare.Email.BlockSender("SpamDomain", {
 *   pattern: "spam-source.example.net",
 *   patternType: "DOMAIN",
 * });
 * ```
 *
 * **Example:** Block by regular expression
 * ```typescript
 * yield* Cloudflare.Email.BlockSender("LookalikeSenders", {
 *   pattern: ".*@examp1e\\.com$",
 *   patternType: "EMAIL",
 *   isRegex: true,
 * });
 * ```
 *
 * @see https://developers.cloudflare.com/cloudflare-one/email-security/
 *
 * @resource
 * @product Email Security
 * @category Email
 */
export const BlockSender = Resource(EmailSecurityBlockSenderTypeId, { aliases: ["Cloudflare.EmailSecurity.BlockSender"] });
/**
 * Returns true if the given value is an BlockSender resource.
 */
export const isBlockSender = (value) => Predicate.hasProperty(value, "Type") &&
    value.Type === EmailSecurityBlockSenderTypeId;
export const BlockSenderProvider = () => Provider.succeed(BlockSender, {
    stables: ["blockSenderId", "accountId", "createdAt"],
    read: Effect.fn(function* ({ output, olds }) {
        const { accountId } = yield* yield* CloudflareEnvironment;
        const acct = output?.accountId ?? accountId;
        // Owned path: refresh by the persisted entry id.
        if (output?.blockSenderId) {
            const observed = yield* getBlockSender(acct, output.blockSenderId);
            if (observed)
                return toAttributes(observed, acct);
        }
        // Cold lookup: recover by pattern; matches are reported as `Unowned`
        // so takeover is gated behind the adopt policy.
        const pattern = output?.pattern ?? olds?.pattern;
        if (pattern !== undefined) {
            const observed = yield* findByPattern(acct, pattern);
            if (observed)
                return Unowned(toAttributes(observed, acct));
        }
        return undefined;
    }),
    reconcile: Effect.fn(function* ({ news, output }) {
        const { accountId } = yield* yield* CloudflareEnvironment;
        // 1. Observe — id hint first, then pattern scan.
        let observed = output?.blockSenderId
            ? yield* getBlockSender(accountId, output.blockSenderId)
            : undefined;
        if (!observed) {
            observed = yield* findByPattern(accountId, news.pattern);
        }
        // 2. Ensure — create when missing.
        if (!observed) {
            const created = yield* emailSecurity.createSettingBlockSender({
                accountId,
                pattern: news.pattern,
                patternType: news.patternType,
                isRegex: news.isRegex ?? false,
                comments: news.comments,
            });
            return toAttributes(created, accountId);
        }
        // 3. Sync — patch only on a delta.
        const dirty = (observed.pattern ?? "") !== news.pattern ||
            (observed.patternType ?? "") !== news.patternType ||
            (observed.isRegex ?? false) !== (news.isRegex ?? false) ||
            (news.comments !== undefined &&
                (observed.comments ?? "") !== news.comments);
        if (!dirty) {
            return toAttributes(observed, accountId);
        }
        const patched = yield* emailSecurity.patchSettingBlockSender({
            accountId,
            patternId: observed.id ?? "",
            pattern: news.pattern,
            patternType: news.patternType,
            isRegex: news.isRegex ?? false,
            comments: news.comments,
        });
        return toAttributes(patched, accountId);
    }),
    delete: Effect.fn(function* ({ output }) {
        yield* emailSecurity
            .deleteSettingBlockSender({
            accountId: output.accountId,
            patternId: output.blockSenderId,
        })
            .pipe(Effect.catchTag("BlockSenderNotFound", () => Effect.void));
    }),
    // Account collection: enumerate every blocked sender in the ambient
    // account, exhaustively paginating. Each list item already carries the
    // full entry shape, so it hydrates directly into `read`'s Attributes with
    // no per-item follow-up. Email Security is a paid add-on, so accounts
    // without the entitlement (or without permission) have nothing to
    // enumerate and yield an empty array.
    list: Effect.fn(function* () {
        const { accountId } = yield* yield* CloudflareEnvironment;
        return yield* emailSecurity.listSettingBlockSenders
            .pages({ accountId })
            .pipe(Stream.runCollect, Effect.map((chunk) => Array.from(chunk).flatMap((page) => (page.result ?? []).map((entry) => toAttributes(entry, accountId)))), Effect.catchTag("EmailSecurityNotEntitled", () => Effect.succeed([])), Effect.catchTag("Forbidden", () => Effect.succeed([])));
    }),
});
/**
 * Read a blocked sender by id, mapping "gone" (`BlockSenderNotFound`,
 * HTTP 404) to `undefined`.
 */
const getBlockSender = (accountId, patternId) => emailSecurity.getSettingBlockSender({ accountId, patternId }).pipe(Effect.map((entry) => entry), Effect.catchTag("BlockSenderNotFound", () => Effect.succeed(undefined)));
/**
 * Find a blocked sender by exact pattern. The `pattern` query filter is a
 * server-side hint; the exact match is re-checked client-side. Picks the
 * oldest match for determinism.
 */
const findByPattern = (accountId, pattern) => emailSecurity.listSettingBlockSenders.items({ accountId, pattern }).pipe(Stream.runCollect, Effect.map((chunk) => Array.from(chunk)
    .filter((entry) => entry.pattern === pattern)
    .sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""))
    .at(0)));
const toAttributes = (entry, accountId) => ({
    blockSenderId: entry.id ?? "",
    accountId,
    pattern: entry.pattern ?? "",
    patternType: (entry.patternType ?? "EMAIL"),
    isRegex: entry.isRegex ?? false,
    comments: entry.comments ?? undefined,
    createdAt: entry.createdAt ?? "",
    modifiedAt: entry.modifiedAt ?? undefined,
});
//# sourceMappingURL=BlockSender.js.map