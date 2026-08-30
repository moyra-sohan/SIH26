import * as contacts from "@distilled.cloud/aws/ssm-contacts";
import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";
import { Unowned } from "../../AdoptPolicy.js";
import { isResolved } from "../../Diff.js";
import { createPhysicalName } from "../../PhysicalName.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
import { createInternalTags, createTagsList, diffTags, hasAlchemyTags, tagRecord, } from "../../Tags.js";
import { AWSEnvironment } from "../Environment.js";
/**
 * An Incident Manager contact — a person Incident Manager engages during an
 * incident, an escalation plan that engages contacts in phases, or an
 * on-call schedule backed by rotations.
 *
 * Requires the account's Incident Manager replication set
 * (`SSMIncidents.ReplicationSet`) to exist.
 *
 * ### Creating Contacts
 * **Example:** Personal contact
 * ```typescript
 * const oncall = yield* SSMContacts.Contact("Oncall", {
 *   type: "PERSONAL",
 *   displayName: "Primary On-Call",
 * });
 * ```
 *
 * **Example:** Contact with an inline engagement plan
 * ```typescript
 * const channel = yield* SSMContacts.ContactChannel("Email", {
 *   contactId: oncall.contactArn,
 *   type: "EMAIL",
 *   deliveryAddress: { SimpleAddress: "oncall@example.com" },
 *   deferActivation: true,
 * });
 * const escalation = yield* SSMContacts.Contact("Escalation", {
 *   type: "ESCALATION",
 *   plan: {
 *     Stages: [
 *       {
 *         DurationInMinutes: 5,
 *         Targets: [
 *           { ContactTargetInfo: { ContactId: oncall.contactArn, IsEssential: true } },
 *         ],
 *       },
 *     ],
 *   },
 * });
 * ```
 */
const ContactResource = Resource("AWS.SSMContacts.Contact");
export { ContactResource as Contact };
const normalize = (value) => {
    if (Array.isArray(value))
        return value.map(normalize);
    if (value !== null && typeof value === "object") {
        return Object.fromEntries(Object.entries(value)
            .filter(([, v]) => v !== undefined)
            .sort(([l], [r]) => l.localeCompare(r))
            .map(([k, v]) => [k, normalize(v)]));
    }
    return value;
};
const same = (l, r) => JSON.stringify(normalize(l)) === JSON.stringify(normalize(r));
/** Parse a policy JSON string for structural comparison; fall back to the raw string. */
const parsePolicy = (policy) => {
    try {
        return JSON.parse(policy);
    }
    catch {
        return policy;
    }
};
/** Builds the ARN of a contact from its alias in the ambient account/region. */
export const contactArn = Effect.fn(function* (alias) {
    const { accountId, region } = yield* AWSEnvironment.current;
    return `arn:aws:ssm-contacts:${region}:${accountId}:contact/${alias}`;
});
export const ContactProvider = () => Provider.effect(ContactResource, Effect.gen(function* () {
    const createAlias = Effect.fn(function* (id, props) {
        // Contact aliases must be lowercase.
        return (props.alias ??
            (yield* createPhysicalName({ id, maxLength: 200, lowercase: true })));
    });
    const getContact = (arn) => contacts
        .getContact({ ContactId: arn })
        .pipe(Effect.catchTag("ResourceNotFoundException", () => Effect.succeed(undefined)));
    const readTags = (arn) => contacts.listTagsForResource({ ResourceARN: arn }).pipe(
    // Distilled Tag has optional Key/Value; narrow to defined pairs
    // before handing off to the shared tagRecord helper.
    Effect.map((r) => tagRecord((r.Tags ?? []).flatMap((t) => t.Key !== undefined && t.Value !== undefined
        ? [{ Key: t.Key, Value: t.Value }]
        : []))), Effect.catch(() => Effect.succeed({})));
    const buildAttrs = (contact) => ({
        contactArn: contact.ContactArn,
        alias: contact.Alias,
        type: contact.Type,
        displayName: contact.DisplayName,
    });
    return ContactResource.Provider.of({
        stables: ["contactArn", "alias", "type"],
        list: () => contacts.listContacts.items({}).pipe(Stream.runCollect, Effect.map((chunk) => Array.from(chunk).map((contact) => ({
            contactArn: contact.ContactArn,
            alias: contact.Alias,
            type: contact.Type,
            displayName: contact.DisplayName,
        })))),
        read: Effect.fn(function* ({ id, olds, output }) {
            const alias = output?.alias ?? (yield* createAlias(id, olds ?? {}));
            const arn = output?.contactArn ?? (yield* contactArn(alias));
            const contact = yield* getContact(arn);
            if (contact === undefined)
                return undefined;
            const attrs = buildAttrs(contact);
            const tags = yield* readTags(contact.ContactArn);
            return (yield* hasAlchemyTags(id, tags)) ? attrs : Unowned(attrs);
        }),
        // Alias and type are create-only; display name, plan, and tags update
        // in place.
        diff: Effect.fn(function* ({ id, news, olds }) {
            if (!isResolved(news))
                return undefined;
            const oldAlias = yield* createAlias(id, olds);
            const newAlias = yield* createAlias(id, news);
            if (oldAlias !== newAlias)
                return { action: "replace" };
            if (olds.type !== news.type)
                return { action: "replace" };
        }),
        reconcile: Effect.fn(function* ({ id, news, output, session }) {
            const alias = output?.alias ?? (yield* createAlias(id, news));
            const arn = output?.contactArn ?? (yield* contactArn(alias));
            const internalTags = yield* createInternalTags(id);
            const desiredTags = { ...news.tags, ...internalTags };
            // 1. OBSERVE
            let contact = yield* getContact(arn);
            // 2. ENSURE — create if missing; tolerate the already-exists race.
            if (contact === undefined) {
                yield* session.note(`creating contact ${alias}`);
                yield* contacts
                    .createContact({
                    Alias: alias,
                    DisplayName: news.displayName,
                    Type: news.type,
                    Plan: news.plan ?? { Stages: [] },
                    Tags: createTagsList(desiredTags),
                })
                    .pipe(Effect.asVoid, Effect.catchTag("ConflictException", () => Effect.void));
                contact = (yield* getContact(arn));
            }
            // 3. SYNC display name + plan — diff observed against desired.
            //    `plan` is only managed here when the prop is provided, so the
            //    standalone `SSMContacts.Plan` resource can own it otherwise.
            const displayNameDelta = (contact.DisplayName ?? "") !== (news.displayName ?? "");
            const planDelta = news.plan !== undefined && !same(contact.Plan, news.plan);
            if (displayNameDelta || planDelta) {
                yield* contacts.updateContact({
                    ContactId: contact.ContactArn,
                    DisplayName: news.displayName ?? "",
                    ...(planDelta ? { Plan: news.plan } : {}),
                });
            }
            // 3b. SYNC resource policy — observed vs desired. Only managed
            //     when the prop is provided; there is no delete-policy API.
            if (news.policy !== undefined) {
                const desiredPolicy = typeof news.policy === "string"
                    ? news.policy
                    : JSON.stringify(news.policy);
                const observedPolicy = yield* contacts
                    .getContactPolicy({ ContactArn: contact.ContactArn })
                    .pipe(Effect.map((r) => r.Policy), Effect.catchTag("ResourceNotFoundException", () => Effect.succeed(undefined)));
                if (observedPolicy === undefined ||
                    !same(parsePolicy(observedPolicy), parsePolicy(desiredPolicy))) {
                    yield* contacts.putContactPolicy({
                        ContactArn: contact.ContactArn,
                        Policy: desiredPolicy,
                    });
                }
            }
            // 3c. SYNC tags — diff against OBSERVED cloud tags.
            const currentTags = yield* readTags(contact.ContactArn);
            const { upsert, removed } = diffTags(currentTags, desiredTags);
            if (upsert.length > 0) {
                yield* contacts.tagResource({
                    ResourceARN: contact.ContactArn,
                    Tags: upsert,
                });
            }
            if (removed.length > 0) {
                yield* contacts.untagResource({
                    ResourceARN: contact.ContactArn,
                    TagKeys: removed,
                });
            }
            // 4. RETURN fresh attributes.
            const final = (yield* getContact(contact.ContactArn));
            yield* session.note(final.ContactArn);
            return buildAttrs(final);
        }),
        delete: Effect.fn(function* ({ output }) {
            yield* contacts.deleteContact({ ContactId: output.contactArn }).pipe(Effect.asVoid, Effect.catchTag("ResourceNotFoundException", () => Effect.void));
        }),
    });
}));
//# sourceMappingURL=Contact.js.map