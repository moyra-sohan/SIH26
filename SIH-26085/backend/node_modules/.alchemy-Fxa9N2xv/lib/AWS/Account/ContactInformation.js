import * as account from "@distilled.cloud/aws/account";
import * as Effect from "effect/Effect";
import { isResolved } from "../../Diff.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
import { unwrapSensitive } from "./internal.js";
/**
 * The primary contact information of an AWS account — the account-global
 * mailing address and phone number AWS uses to reach the account owner. Every
 * account has exactly one primary contact; this resource upserts it via
 * `account:PutContactInformation`. AWS does not allow deleting the primary
 * contact, so destroying the resource stops managing it and leaves the last
 * value in place.
 *
 * ### Setting the Primary Contact
 * **Example:** Primary Contact for the Calling Account
 * ```typescript
 * const contact = yield* ContactInformation("PrimaryContact", {
 *   fullName: "Jane Doe",
 *   addressLine1: "123 Any Street",
 *   city: "Seattle",
 *   stateOrRegion: "WA",
 *   postalCode: "98101",
 *   countryCode: "US",
 *   phoneNumber: "+12065551234",
 *   companyName: "Acme Corp",
 *   websiteUrl: "https://acme.example.com",
 * });
 * ```
 *
 * **Example:** Primary Contact for an Organizations Member Account
 * ```typescript
 * const contact = yield* ContactInformation("MemberContact", {
 *   fullName: "Acme Ops",
 *   addressLine1: "123 Any Street",
 *   city: "Seattle",
 *   postalCode: "98101",
 *   countryCode: "US",
 *   phoneNumber: "+12065551234",
 *   accountId: "123456789012",
 * });
 * ```
 *
 * @resource
 */
export const ContactInformation = Resource("AWS.Account.ContactInformation");
export const ContactInformationProvider = () => Provider.effect(ContactInformation, Effect.gen(function* () {
    const toAttributes = (contact) => ({
        fullName: unwrapSensitive(contact.FullName) ?? "",
        addressLine1: unwrapSensitive(contact.AddressLine1) ?? "",
        addressLine2: unwrapSensitive(contact.AddressLine2),
        addressLine3: unwrapSensitive(contact.AddressLine3),
        city: unwrapSensitive(contact.City) ?? "",
        stateOrRegion: unwrapSensitive(contact.StateOrRegion),
        districtOrCounty: unwrapSensitive(contact.DistrictOrCounty),
        postalCode: unwrapSensitive(contact.PostalCode) ?? "",
        countryCode: unwrapSensitive(contact.CountryCode) ?? "",
        phoneNumber: unwrapSensitive(contact.PhoneNumber) ?? "",
        companyName: unwrapSensitive(contact.CompanyName),
        websiteUrl: unwrapSensitive(contact.WebsiteUrl),
    });
    const observe = (accountId) => account.getContactInformation({ AccountId: accountId }).pipe(Effect.map((r) => r.ContactInformation
        ? toAttributes(r.ContactInformation)
        : undefined), Effect.catchTag("ResourceNotFoundException", () => Effect.succeed(undefined)));
    return {
        // Account-global singleton setting: nuke must not wipe the real
        // primary contact of the account.
        nuke: { skip: true },
        stables: [],
        // Targeting a different account manages a different singleton, so an
        // accountId change replaces rather than mutating the old target.
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
            // The primary contact is a singleton driven entirely by
            // `putContactInformation`, which is a full upsert — the request
            // payload *is* the desired state.
            yield* account.putContactInformation({
                ContactInformation: {
                    FullName: news.fullName,
                    AddressLine1: news.addressLine1,
                    AddressLine2: news.addressLine2,
                    AddressLine3: news.addressLine3,
                    City: news.city,
                    StateOrRegion: news.stateOrRegion,
                    DistrictOrCounty: news.districtOrCounty,
                    PostalCode: news.postalCode,
                    CountryCode: news.countryCode,
                    PhoneNumber: news.phoneNumber,
                    CompanyName: news.companyName,
                    WebsiteUrl: news.websiteUrl,
                },
                AccountId: news.accountId,
            });
            yield* session.note(news.fullName);
            return {
                fullName: news.fullName,
                addressLine1: news.addressLine1,
                addressLine2: news.addressLine2,
                addressLine3: news.addressLine3,
                city: news.city,
                stateOrRegion: news.stateOrRegion,
                districtOrCounty: news.districtOrCounty,
                postalCode: news.postalCode,
                countryCode: news.countryCode,
                phoneNumber: news.phoneNumber,
                companyName: news.companyName,
                websiteUrl: news.websiteUrl,
            };
        }),
        // Account-global singleton: return the one contact if it exists.
        list: () => observe(undefined).pipe(Effect.map((contact) => (contact ? [contact] : []))),
        // AWS does not allow deleting the primary contact of an account —
        // destroy just stops managing it and leaves the last value in place.
        delete: Effect.fn(function* () { }),
    };
}));
//# sourceMappingURL=ContactInformation.js.map