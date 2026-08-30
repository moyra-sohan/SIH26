import * as account from "@distilled.cloud/aws/account";
import * as Effect from "effect/Effect";
import * as Schedule from "effect/Schedule";
import { isResolved } from "../../Diff.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
import { unwrapSensitive } from "./internal.js";
/**
 * The display name of an AWS account. Every account has exactly one name; this
 * account-global singleton sets it via `account:PutAccountName`. Deleting the
 * resource stops managing the name and leaves the last value in place (an
 * account always has a name).
 *
 * ### Naming the Account
 * **Example:** Set the Calling Account's Name
 * ```typescript
 * const name = yield* AccountName("Name", {
 *   accountName: "acme-prod",
 * });
 * ```
 *
 * **Example:** Rename an Organizations Member Account
 * ```typescript
 * const name = yield* AccountName("MemberName", {
 *   accountName: "acme-sandbox",
 *   accountId: "123456789012",
 * });
 * ```
 *
 * @resource
 */
export const AccountName = Resource("AWS.Account.AccountName");
export const AccountNameProvider = () => Provider.effect(AccountName, Effect.gen(function* () {
    const observe = (accountId) => account.getAccountInformation({ AccountId: accountId }).pipe(Effect.map((info) => ({
        accountName: unwrapSensitive(info.AccountName) ?? "",
        accountId: info.AccountId ?? accountId ?? "",
        accountState: info.AccountState,
        accountCreatedDate: info.AccountCreatedDate?.toISOString(),
    })));
    return {
        // Account-global singleton setting: nuke must not rename accounts.
        nuke: { skip: true },
        stables: [],
        // Targeting a different account manages a different singleton, so an
        // accountId change replaces rather than renaming the old target.
        diff: Effect.fn(function* ({ olds, news }) {
            if (!isResolved(news))
                return;
            if ((olds?.accountId ?? news.accountId) !== news.accountId) {
                return { action: "replace" };
            }
        }),
        read: Effect.fn(function* ({ olds }) {
            return yield* observe(olds?.accountId);
        }),
        reconcile: Effect.fn(function* ({ news, session }) {
            yield* account.putAccountName({
                AccountName: news.accountName,
                AccountId: news.accountId,
            });
            // putAccountName is eventually consistent: getAccountInformation
            // can keep returning the previous name for ~20 seconds. Poll
            // (bounded) until the rename is observable; if it is still stale
            // after the budget, report the desired name — the put succeeded,
            // so it is authoritative.
            const observed = yield* observe(news.accountId).pipe(Effect.repeat({
                schedule: Schedule.spaced("3 seconds"),
                until: (o) => o.accountName === news.accountName,
                times: 10,
            }));
            yield* session.note(news.accountName);
            return observed.accountName === news.accountName
                ? observed
                : { ...observed, accountName: news.accountName };
        }),
        // Account-global singleton: the one name always exists.
        list: () => observe(undefined).pipe(Effect.map((observed) => [observed])),
        // An AWS account always has a name — there is nothing to delete.
        // Destroy just stops managing it, mirroring the console behavior.
        delete: Effect.fn(function* () { }),
    };
}));
//# sourceMappingURL=AccountName.js.map