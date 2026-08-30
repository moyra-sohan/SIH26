import * as accounts from "@distilled.cloud/cloudflare/accounts";
import * as Effect from "effect/Effect";
import * as Predicate from "effect/Predicate";
import * as Stream from "effect/Stream";
import { isResolved } from "../../Diff.js";
import { createPhysicalName } from "../../PhysicalName.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
const TypeId = "Cloudflare.Account.Account";
/**
 * A Cloudflare account (subaccount), for tenant / partner platforms that
 * provision an account per customer.
 *
 * Creating accounts (`POST /accounts`) is restricted to credentials with the
 * tenant entitlement — a standard user receives the typed
 * `AccountCreationForbidden` error (Cloudflare error code 1002). The `name`
 * and account settings are mutable in place; `type` and the tenant `unit`
 * are create-only and trigger a replacement. Deleting the resource queues
 * the account for deletion (also tenant-gated).
 *
 * The account's physical identity is the Cloudflare-assigned `accountId`.
 * Account names are not unique, so there is no find-by-name fallback: if
 * state is lost, the account is treated as missing rather than guessed at.
 * ### Creating an account
 * **Example:** Standard subaccount with a generated name
 * ```typescript
 * const account = yield* Cloudflare.Account.Account("CustomerAccount", {});
 * ```
 *
 * **Example:** Subaccount on a specific tenant unit
 * ```typescript
 * const account = yield* Cloudflare.Account.Account("CustomerAccount", {
 *   name: "Customer: ACME Inc",
 *   unit: { id: tenantUnitId },
 * });
 * ```
 *
 * ### Account settings
 * **Example:** Enforce two-factor authentication for all members
 * ```typescript
 * const account = yield* Cloudflare.Account.Account("CustomerAccount", {
 *   name: "Customer: ACME Inc",
 *   enforceTwofactor: true,
 *   abuseContactEmail: "abuse@acme.example",
 * });
 * ```
 *
 * @see https://developers.cloudflare.com/tenant/how-to/manage-accounts/
 *
 * @resource
 * @product Accounts
 * @category Account & Identity
 */
export const Account = Resource(TypeId, {
    aliases: ["Cloudflare.Account"],
});
/**
 * Returns true if the given value is an Account resource.
 */
export const isAccount = (value) => Predicate.hasProperty(value, "Type") && value.Type === TypeId;
export const AccountProvider = () => Provider.succeed(Account, {
    stables: ["accountId", "type", "createdOn", "parentOrgId", "parentOrgName"],
    diff: Effect.fn(function* ({ olds, news, output }) {
        if (!isResolved(news))
            return undefined;
        // The account type cannot be changed after creation — Cloudflare
        // rejects it with `UpdateAccountTypeNotSupported`.
        const oldType = output?.type ?? olds?.type ?? "standard";
        if ((news.type ?? "standard") !== oldType) {
            return { action: "replace" };
        }
        // The tenant unit is a create-only placement decision.
        if ((olds?.unit?.id ?? undefined) !== (news.unit?.id ?? undefined)) {
            return { action: "replace" };
        }
        return undefined;
    }),
    list: () => 
    // `listAccounts` (GET /accounts) enumerates every account the API
    // token can access — no scope input required. The list items carry
    // the full account shape (settings + managedBy), so each maps
    // directly to the same `Attributes` `read` produces with no
    // per-item hydration. Paginate exhaustively.
    accounts.listAccounts.pages({}).pipe(Stream.runCollect, Effect.map((chunk) => Array.from(chunk).flatMap((page) => (page.result ?? []).map((account) => toAttributes(account))))),
    read: Effect.fn(function* ({ output }) {
        // The physical identity is the Cloudflare-assigned account id —
        // names are not unique, so there is no cold find-by-name fallback.
        if (!output?.accountId)
            return undefined;
        const observed = yield* getAccount(output.accountId);
        return observed ? toAttributes(observed) : undefined;
    }),
    reconcile: Effect.fn(function* ({ id, news, output }) {
        const name = news.name ?? (yield* createPhysicalName({ id, lowercase: true }));
        // 1. Observe — the account id cached on `output` is a hint, not a
        //    guarantee: a deleted account falls through to create.
        let observed = output?.accountId
            ? yield* getAccount(output.accountId)
            : undefined;
        // 2. Ensure — create when missing. Names are not unique on
        //    Cloudflare's side, so there is no AlreadyExists race to
        //    tolerate. Requires the tenant entitlement: a standard user
        //    surfaces the typed `AccountCreationForbidden` (code 1002).
        if (!observed) {
            observed = yield* accounts.createAccount({
                name,
                type: news.type,
                unit: news.unit,
            });
        }
        // 3. Sync — diff observed cloud state against desired; skip the PUT
        //    entirely on a no-op. Settings props left undefined are
        //    unmanaged: the observed value is kept as-is.
        const settings = observed.settings ?? undefined;
        const nameDirty = observed.name !== name;
        const abuseDirty = news.abuseContactEmail !== undefined &&
            (settings?.abuseContactEmail ?? undefined) !== news.abuseContactEmail;
        const twofactorDirty = news.enforceTwofactor !== undefined &&
            (settings?.enforceTwofactor ?? false) !== news.enforceTwofactor;
        if (nameDirty || abuseDirty || twofactorDirty) {
            observed = yield* accounts.updateAccount({
                accountId: observed.id,
                id: observed.id,
                name,
                settings: abuseDirty || twofactorDirty
                    ? {
                        abuseContactEmail: news.abuseContactEmail,
                        enforceTwofactor: news.enforceTwofactor,
                    }
                    : undefined,
            });
        }
        return toAttributes(observed);
    }),
    delete: Effect.fn(function* ({ output }) {
        // Account deletion is queued / asynchronous on Cloudflare's side —
        // a successful DELETE means "pending deletion", which is success for
        // us. An already-gone (or already-pending) account surfaces as
        // `InvalidRoute` (code 7003): that's success too.
        yield* accounts
            .deleteAccount({ accountId: output.accountId })
            .pipe(Effect.catchTag("InvalidRoute", () => Effect.void));
    }),
});
/**
 * Read an account by id, mapping "gone" to `undefined`. A missing (or
 * deletion-pending) account surfaces as `InvalidRoute` (Cloudflare error
 * code 7003).
 */
const getAccount = (accountId) => accounts.getAccount({ accountId }).pipe(Effect.map((account) => account), Effect.catchTag("InvalidRoute", () => Effect.succeed(undefined)));
const toAttributes = (account) => ({
    accountId: account.id,
    name: account.name,
    // Distilled widens generated string enums to open unions (`string & {}`).
    type: account.type,
    createdOn: account.createdOn ?? undefined,
    parentOrgId: account.managedBy?.parentOrgId ?? undefined,
    parentOrgName: account.managedBy?.parentOrgName ?? undefined,
    abuseContactEmail: account.settings?.abuseContactEmail ?? undefined,
    enforceTwofactor: account.settings?.enforceTwofactor ?? false,
});
//# sourceMappingURL=Account.js.map