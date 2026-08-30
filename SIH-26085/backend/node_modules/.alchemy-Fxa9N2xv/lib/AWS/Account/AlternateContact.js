import * as account from "@distilled.cloud/aws/account";
import * as Effect from "effect/Effect";
import { isResolved } from "../../Diff.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
import { unwrapSensitive as unwrap } from "./internal.js";
const ALL_CONTACT_TYPES = [
    "BILLING",
    "OPERATIONS",
    "SECURITY",
];
/**
 * An alternate contact for an AWS account. AWS accounts support one alternate
 * contact for each of the `BILLING`, `OPERATIONS`, and `SECURITY` categories.
 * These are account-global singletons: setting one overwrites any existing
 * contact of the same type, and deleting removes it entirely.
 *
 * ### Setting an Alternate Contact
 * **Example:** Operations Contact
 * ```typescript
 * const contact = yield* AlternateContact("OpsContact", {
 *   alternateContactType: "OPERATIONS",
 *   name: "Ops Team",
 *   title: "On-Call Engineer",
 *   emailAddress: "ops@example.com",
 *   phoneNumber: "+15555550123",
 * });
 * ```
 *
 * **Example:** Billing Contact for an Organizations Member Account
 * ```typescript
 * const contact = yield* AlternateContact("BillingContact", {
 *   alternateContactType: "BILLING",
 *   name: "Finance",
 *   title: "AP Clerk",
 *   emailAddress: "ap@example.com",
 *   phoneNumber: "+15555550124",
 *   accountId: "123456789012",
 * });
 * ```
 *
 * @resource
 */
export const AlternateContact = Resource("AWS.Account.AlternateContact");
export const AlternateContactProvider = () => Provider.effect(AlternateContact, Effect.gen(function* () {
    const observe = (alternateContactType, accountId) => account
        .getAlternateContact({
        AlternateContactType: alternateContactType,
        AccountId: accountId,
    })
        .pipe(Effect.map((r) => r.AlternateContact), Effect.catchTag("ResourceNotFoundException", () => Effect.succeed(undefined)));
    return {
        // Account-global singleton setting: nuke must not wipe real account
        // contacts it never created.
        nuke: { skip: true },
        stables: [],
        // Changing the contact type targets a different account-global slot, so
        // it must replace rather than mutate the old slot in place.
        diff: Effect.fn(function* ({ olds, news }) {
            if (!isResolved(news))
                return;
            if ((olds?.alternateContactType ?? news.alternateContactType) !==
                news.alternateContactType) {
                return { action: "replace" };
            }
        }),
        read: Effect.fn(function* ({ olds, output }) {
            const type = output?.alternateContactType ?? olds?.alternateContactType;
            if (!type)
                return undefined;
            const accountId = olds?.accountId;
            const contact = yield* observe(type, accountId);
            if (!contact)
                return undefined;
            return {
                alternateContactType: type,
                name: unwrap(contact.Name) ?? output?.name ?? "",
                title: unwrap(contact.Title) ?? output?.title ?? "",
                emailAddress: unwrap(contact.EmailAddress) ?? output?.emailAddress ?? "",
                phoneNumber: unwrap(contact.PhoneNumber) ?? output?.phoneNumber ?? "",
            };
        }),
        reconcile: Effect.fn(function* ({ news, session }) {
            yield* account.putAlternateContact({
                AlternateContactType: news.alternateContactType,
                Name: news.name,
                Title: news.title,
                EmailAddress: news.emailAddress,
                PhoneNumber: news.phoneNumber,
                AccountId: news.accountId,
            });
            yield* session.note(`${news.alternateContactType}:${news.emailAddress}`);
            return {
                alternateContactType: news.alternateContactType,
                name: news.name,
                title: news.title,
                emailAddress: news.emailAddress,
                phoneNumber: news.phoneNumber,
            };
        }),
        // Account-global singleton: enumerate each of the three contact slots
        // and return whichever ones exist.
        list: () => Effect.gen(function* () {
            const contacts = yield* Effect.forEach(ALL_CONTACT_TYPES, (type) => observe(type, undefined).pipe(Effect.map((contact) => contact
                ? {
                    alternateContactType: type,
                    name: unwrap(contact.Name) ?? "",
                    title: unwrap(contact.Title) ?? "",
                    emailAddress: unwrap(contact.EmailAddress) ?? "",
                    phoneNumber: unwrap(contact.PhoneNumber) ?? "",
                }
                : undefined)), { concurrency: 3 });
            return contacts.filter((c) => c !== undefined);
        }),
        delete: Effect.fn(function* ({ output, olds }) {
            yield* account
                .deleteAlternateContact({
                AlternateContactType: output.alternateContactType,
                AccountId: olds.accountId,
            })
                .pipe(Effect.catchTag("ResourceNotFoundException", () => Effect.void));
        }),
    };
}));
//# sourceMappingURL=AlternateContact.js.map