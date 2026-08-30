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
 * An SES Mail Manager email archive — durable storage for emails captured
 * by an `Archive` rule action, searchable and exportable for compliance.
 *
 * Deleting an archive puts it into `PENDING_DELETION` for 30 days before
 * its contents are permanently removed; the archive cannot be revived, so
 * the provider treats a pending-deletion archive as gone.
 * ### Creating Archives
 * **Example:** Compliance Archive
 * ```typescript
 * import * as MailManager from "alchemy/AWS/MailManager";
 *
 * const archive = yield* MailManager.Archive("Compliance", {
 *   retentionPeriod: "ONE_YEAR",
 * });
 *
 * const ruleSet = yield* MailManager.RuleSet("Inbound", {
 *   rules: [
 *     {
 *       Name: "ArchiveAll",
 *       Actions: [{ Archive: { TargetArchive: archive.archiveId } }],
 *     },
 *   ],
 * });
 * ```
 *
 * ### Searching the Archive at Runtime
 * **Example:** Search Archived Mail from a Lambda
 * ```typescript
 * // init — bind the search capabilities to the archive
 * const startSearch = yield* MailManager.StartArchiveSearch(archive);
 * const getSearchResults = yield* MailManager.GetArchiveSearchResults(archive);
 *
 * // runtime
 * const { SearchId } = yield* startSearch({
 *   FromTimestamp: new Date(Date.now() - 86_400_000),
 *   ToTimestamp: new Date(),
 *   MaxResults: 100,
 * });
 * ```
 *
 * @resource
 */
export const Archive = Resource("AWS.MailManager.Archive");
export const ArchiveProvider = () => Provider.effect(Archive, Effect.gen(function* () {
    const createName = Effect.fn(function* (id, props) {
        return (props.archiveName ??
            (yield* createPhysicalName({ id, maxLength: 64 })));
    });
    // A PENDING_DELETION archive is irrevocably deleted (contents already
    // inaccessible) — treat it as gone everywhere.
    const getById = (archiveId) => mm.getArchive({ ArchiveId: archiveId }).pipe(Effect.map((a) => a.ArchiveState === "PENDING_DELETION" ? undefined : a), Effect.catchTag("ResourceNotFoundException", () => Effect.succeed(undefined)));
    // Archives have no name-keyed Get — enumerate and match, skipping
    // tombstones in PENDING_DELETION.
    const findByName = (name) => mm.listArchives.pages({}).pipe(Stream.runCollect, Effect.map((chunk) => Array.from(chunk)
        .flatMap((page) => page.Archives ?? [])
        .find((a) => a.ArchiveName === name &&
        a.ArchiveState !== "PENDING_DELETION")));
    const observe = Effect.fn(function* (output, name) {
        if (output?.archiveId !== undefined) {
            const found = yield* getById(output.archiveId);
            if (found !== undefined)
                return found;
        }
        const summary = yield* findByName(name);
        if (summary?.ArchiveId === undefined)
            return undefined;
        return yield* getById(summary.ArchiveId);
    });
    const toAttrs = (archive) => ({
        archiveId: archive.ArchiveId,
        archiveArn: archive.ArchiveArn,
        archiveName: archive.ArchiveName,
        archiveState: archive.ArchiveState,
    });
    return Archive.Provider.of({
        stables: ["archiveId", "archiveArn"],
        list: () => mm.listArchives.pages({}).pipe(Stream.runCollect, Effect.flatMap((chunk) => Effect.forEach(Array.from(chunk)
            .flatMap((page) => page.Archives ?? [])
            .filter((a) => a.ArchiveState !== "PENDING_DELETION")
            .map((a) => a.ArchiveId), (archiveId) => getById(archiveId))), Effect.map((results) => results.flatMap((a) => (a === undefined ? [] : [toAttrs(a)])))),
        read: Effect.fn(function* ({ id, olds, output }) {
            const name = output?.archiveName ?? (yield* createName(id, olds ?? {}));
            const archive = yield* observe(output, name);
            if (archive === undefined)
                return undefined;
            const attrs = toAttrs(archive);
            const tags = yield* readMailManagerTags(attrs.archiveArn);
            return (yield* hasAlchemyTags(id, tags)) ? attrs : Unowned(attrs);
        }),
        // The KMS key is create-only — changing it replaces the archive.
        // Name and retention update in place via UpdateArchive.
        diff: Effect.fn(function* ({ news, olds }) {
            if (!isResolved(news))
                return undefined;
            if (olds === undefined)
                return undefined;
            if (olds.kmsKeyArn !== news.kmsKeyArn) {
                return { action: "replace" };
            }
        }),
        reconcile: Effect.fn(function* ({ id, news, output, session }) {
            const name = yield* createName(id, news);
            const internalTags = yield* createInternalTags(id);
            const desiredTags = { ...news.tags, ...internalTags };
            const desiredRetention = news.retentionPeriod ?? "PERMANENT";
            // 1. OBSERVE — cloud state is authoritative; output is an id cache.
            let archive = yield* observe(output, name);
            // 2. ENSURE — create if missing; a Conflict race re-observes by
            //    name instead of failing.
            if (archive === undefined) {
                yield* session.note(`creating archive ${name}`);
                const created = yield* mm
                    .createArchive({
                    ArchiveName: name,
                    Retention: { RetentionPeriod: desiredRetention },
                    KmsKeyArn: news.kmsKeyArn,
                    Tags: createTagsList(desiredTags),
                })
                    .pipe(Effect.catchTag("ConflictException", () => Effect.succeed(undefined)));
                archive =
                    created !== undefined
                        ? yield* getById(created.ArchiveId)
                        : yield* observe(undefined, name);
            }
            if (archive === undefined) {
                return yield* Effect.fail(new Error(`Mail Manager archive '${name}' not found after create`));
            }
            // 3. SYNC — diff OBSERVED name/retention against desired; apply
            //    only the delta.
            if (archive.ArchiveName !== name ||
                archive.Retention?.RetentionPeriod !== desiredRetention) {
                yield* mm.updateArchive({
                    ArchiveId: archive.ArchiveId,
                    ArchiveName: name,
                    Retention: { RetentionPeriod: desiredRetention },
                });
                archive = (yield* getById(archive.ArchiveId)) ?? archive;
            }
            // 3b. SYNC TAGS — against observed cloud tags.
            yield* syncMailManagerTags(archive.ArchiveArn, desiredTags);
            yield* session.note(archive.ArchiveId);
            return { ...toAttrs(archive), archiveName: name };
        }),
        delete: Effect.fn(function* ({ output }) {
            // DeleteArchive's error union carries no not-found tag — deletion
            // is natively idempotent (the archive moves to PENDING_DELETION).
            // An in-flight search or export reports Conflict — retry through.
            yield* retryWhileMailManagerConflict(mm.deleteArchive({ ArchiveId: output.archiveId })).pipe(Effect.asVoid);
        }),
    });
}));
//# sourceMappingURL=Archive.js.map