import * as mm from "@distilled.cloud/aws/mailmanager";
import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";
import { Unowned } from "../../AdoptPolicy.js";
import { isResolved } from "../../Diff.js";
import { createPhysicalName } from "../../PhysicalName.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
import { createInternalTags, createTagsList, hasAlchemyTags, } from "../../Tags.js";
import { readMailManagerTags, retryWhileMailManagerConflict, syncMailManagerTags, } from "./internal.js";
/**
 * An SES Mail Manager address list — a named set of email addresses that
 * traffic policies and rule conditions can match against (allow lists,
 * block lists, routing groups).
 *
 * The list itself is create-only config (name + tags); its members are
 * data managed at runtime via the member capabilities
 * ({@link RegisterMemberToAddressList}, {@link ListMembersOfAddressList},
 * ...) or bulk import jobs.
 * ### Creating Address Lists
 * **Example:** Block List
 * ```typescript
 * import * as MailManager from "alchemy/AWS/MailManager";
 *
 * const blockList = yield* MailManager.AddressList("BlockList", {
 *   tags: { purpose: "smtp-block-list" },
 * });
 * ```
 *
 * ### Managing Members at Runtime
 * **Example:** Register and List Members from a Lambda
 * ```typescript
 * // init — bind the member capabilities to the list
 * const registerMember = yield* MailManager.RegisterMemberToAddressList(blockList);
 * const listMembers = yield* MailManager.ListMembersOfAddressList(blockList);
 *
 * // runtime
 * yield* registerMember({ Address: "spammer@example.com" });
 * const { Addresses } = yield* listMembers({});
 * ```
 *
 * @resource
 */
export const AddressList = Resource("AWS.MailManager.AddressList");
export const AddressListProvider = () => Provider.effect(AddressList, Effect.gen(function* () {
    const createName = Effect.fn(function* (id, props) {
        return (props.addressListName ??
            (yield* createPhysicalName({ id, maxLength: 255 })));
    });
    const getById = (addressListId) => mm
        .getAddressList({ AddressListId: addressListId })
        .pipe(Effect.catchTag("ResourceNotFoundException", () => Effect.succeed(undefined)));
    // Address lists have no name-keyed Get — enumerate and match. The
    // physical name is deterministic, so this recovers identity after a
    // lost state write.
    const findByName = (name) => mm.listAddressLists.pages({}).pipe(Stream.runCollect, Effect.map((chunk) => Array.from(chunk)
        .flatMap((page) => page.AddressLists ?? [])
        .find((l) => l.AddressListName === name)));
    const observe = Effect.fn(function* (output, name) {
        if (output?.addressListId !== undefined) {
            const found = yield* getById(output.addressListId);
            if (found !== undefined)
                return found;
        }
        const summary = yield* findByName(name);
        if (summary?.AddressListId === undefined)
            return undefined;
        return yield* getById(summary.AddressListId);
    });
    const toAttrs = (list) => ({
        addressListId: list.AddressListId,
        addressListArn: list.AddressListArn,
        addressListName: list.AddressListName,
    });
    return AddressList.Provider.of({
        stables: ["addressListId", "addressListArn"],
        list: () => mm.listAddressLists.pages({}).pipe(Stream.runCollect, Effect.map((chunk) => Array.from(chunk)
            .flatMap((page) => page.AddressLists ?? [])
            .map((l) => ({
            addressListId: l.AddressListId,
            addressListArn: l.AddressListArn,
            addressListName: l.AddressListName,
        })))),
        read: Effect.fn(function* ({ id, olds, output }) {
            const name = output?.addressListName ?? (yield* createName(id, olds ?? {}));
            const list = yield* observe(output, name);
            if (list === undefined)
                return undefined;
            const attrs = toAttrs(list);
            const tags = yield* readMailManagerTags(attrs.addressListArn);
            return (yield* hasAlchemyTags(id, tags)) ? attrs : Unowned(attrs);
        }),
        // Mail Manager exposes no UpdateAddressList — a name change can only
        // be realized by replacement.
        diff: Effect.fn(function* ({ news, olds }) {
            if (!isResolved(news))
                return undefined;
            if (olds === undefined)
                return undefined;
            if (news.addressListName !== undefined &&
                olds.addressListName !== news.addressListName) {
                return { action: "replace" };
            }
        }),
        reconcile: Effect.fn(function* ({ id, news, output, session }) {
            const name = yield* createName(id, news);
            const internalTags = yield* createInternalTags(id);
            const desiredTags = { ...news.tags, ...internalTags };
            // 1. OBSERVE — cloud state is authoritative; output is an id cache.
            let list = yield* observe(output, name);
            // 2. ENSURE — create if missing; a Conflict race re-observes by
            //    name instead of failing.
            if (list === undefined) {
                yield* session.note(`creating address list ${name}`);
                const created = yield* mm
                    .createAddressList({
                    AddressListName: name,
                    Tags: createTagsList(desiredTags),
                })
                    .pipe(Effect.catchTag("ConflictException", () => Effect.succeed(undefined)));
                list =
                    created !== undefined
                        ? yield* getById(created.AddressListId)
                        : yield* observe(undefined, name);
            }
            if (list === undefined) {
                return yield* Effect.fail(new Error(`Mail Manager address list '${name}' not found after create`));
            }
            // 3. SYNC TAGS — the only mutable aspect; diffed against observed
            //    cloud tags so adoption converges.
            yield* syncMailManagerTags(list.AddressListArn, desiredTags);
            yield* session.note(list.AddressListId);
            return toAttrs(list);
        }),
        delete: Effect.fn(function* ({ output }) {
            // DeleteAddressList's error union carries no not-found tag —
            // deletion is natively idempotent. A list referenced by an
            // in-flight import job reports Conflict — retry through it.
            yield* retryWhileMailManagerConflict(mm.deleteAddressList({ AddressListId: output.addressListId })).pipe(Effect.asVoid);
        }),
    });
}));
//# sourceMappingURL=AddressList.js.map