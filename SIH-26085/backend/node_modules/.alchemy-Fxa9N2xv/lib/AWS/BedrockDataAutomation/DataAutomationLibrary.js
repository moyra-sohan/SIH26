import * as bda from "@distilled.cloud/aws/bedrock-data-automation";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Schedule from "effect/Schedule";
import * as Stream from "effect/Stream";
import { Unowned } from "../../AdoptPolicy.js";
import { isResolved } from "../../Diff.js";
import { createPhysicalName } from "../../PhysicalName.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
import { createInternalTags, hasAlchemyTags } from "../../Tags.js";
import { readBdaTags, syncBdaTags, toBdaTagList, unredact, } from "./internal.js";
// Explicitly-typed pipeable repeat helper. Inlining `Effect.repeat` in a
// provider lifecycle op leaks its conditional return type into declaration
// emit and widens the provider layer for every consumer of `AWS.providers()`.
const repeatUntilLibraryGone = (self) => Effect.repeat(self, {
    schedule: Schedule.fixed("3 seconds"),
    until: (library) => library === undefined,
    times: 10,
});
/**
 * An Amazon Bedrock Data Automation Library — a store of reusable entities
 * (currently `VOCABULARY` entities: domain phrases with display forms) that
 * data automation projects reference via their
 * `dataAutomationLibraryConfiguration` to improve extraction accuracy.
 *
 * Entities are loaded into the library with ingestion jobs — see the
 * `InvokeDataAutomationLibraryIngestionJob` binding.
 *
 * ### Creating Libraries
 * **Example:** Library with a description
 * ```typescript
 * import * as BDA from "alchemy/AWS/BedrockDataAutomation";
 *
 * const library = yield* BDA.DataAutomationLibrary("Vocab", {
 *   libraryDescription: "domain vocabulary for invoice extraction",
 * });
 * ```
 *
 * **Example:** Reference the library from a project
 * ```typescript
 * const project = yield* BDA.DataAutomationProject("Docs", {
 *   standardOutputConfiguration: {},
 *   dataAutomationLibraryConfiguration: {
 *     libraries: [{ libraryArn: library.libraryArn }],
 *   },
 * });
 * ```
 *
 * @resource
 */
export const DataAutomationLibrary = Resource("AWS.BedrockDataAutomation.DataAutomationLibrary");
/**
 * Raised when a Data Automation library cannot be observed immediately after
 * a successful create — a race with a concurrent delete.
 */
export class DataAutomationLibraryNotObservable extends Data.TaggedError("DataAutomationLibraryNotObservable") {
}
export const DataAutomationLibraryProvider = () => Provider.effect(DataAutomationLibrary, Effect.gen(function* () {
    const createName = Effect.fn(function* (id, props) {
        return (props.libraryName ??
            (yield* createPhysicalName({ id, maxLength: 128 })));
    });
    const toAttributes = (library) => ({
        libraryArn: library.libraryArn,
        libraryName: unredact(library.libraryName),
        status: library.status,
    });
    const observeLibrary = Effect.fn(function* (libraryArn) {
        return yield* bda.getDataAutomationLibrary({ libraryArn }).pipe(Effect.map((r) => r.library), Effect.catchTag("ResourceNotFoundException", () => Effect.succeed(undefined)));
    });
    const findLibraryArn = Effect.fn(function* (name) {
        const summaries = yield* bda.listDataAutomationLibraries
            .items({})
            .pipe(Stream.runCollect);
        return Array.from(summaries).find((s) => s.libraryName !== undefined && unredact(s.libraryName) === name)?.libraryArn;
    });
    return DataAutomationLibrary.Provider.of({
        stables: ["libraryArn", "libraryName"],
        list: () => Effect.gen(function* () {
            const summaries = yield* bda.listDataAutomationLibraries
                .items({})
                .pipe(Stream.runCollect);
            const attrs = yield* Effect.forEach(Array.from(summaries), (s) => observeLibrary(s.libraryArn).pipe(Effect.map((library) => library === undefined ? [] : [toAttributes(library)])), { concurrency: 5 });
            return attrs.flat();
        }),
        read: Effect.fn(function* ({ id, olds, output }) {
            const libraryArn = output?.libraryArn ??
                (yield* findLibraryArn(yield* createName(id, olds ?? {})));
            if (libraryArn === undefined)
                return undefined;
            const found = yield* observeLibrary(libraryArn);
            if (found === undefined)
                return undefined;
            const attrs = toAttributes(found);
            const tags = yield* readBdaTags(libraryArn);
            return (yield* hasAlchemyTags(id, tags)) ? attrs : Unowned(attrs);
        }),
        diff: Effect.fn(function* ({ id, news, olds }) {
            if (!isResolved(news))
                return undefined;
            const oldName = yield* createName(id, olds ?? {});
            const newName = yield* createName(id, news ?? {});
            if (oldName !== newName ||
                // updateDataAutomationLibrary only takes a description, so a KMS
                // key change can only be honored by replacement.
                olds?.encryptionConfiguration?.kmsKeyId !==
                    news.encryptionConfiguration?.kmsKeyId) {
                return { action: "replace" };
            }
            // fall through: engine default update logic for mutable fields
        }),
        reconcile: Effect.fn(function* ({ id, news, output, session }) {
            const libraryName = output?.libraryName ?? (yield* createName(id, news));
            const internalTags = yield* createInternalTags(id);
            const desiredTags = { ...news.tags, ...internalTags };
            // 1. OBSERVE — cloud state is authoritative; output caches the ARN.
            const cachedArn = output?.libraryArn ?? (yield* findLibraryArn(libraryName));
            let live = cachedArn === undefined
                ? undefined
                : yield* observeLibrary(cachedArn);
            // 2. ENSURE — create when missing; a concurrent create surfaces as
            //    the typed ConflictException, which we treat as a race and
            //    re-observe by name. Create returns only arn + status, so
            //    re-observe for the full shape.
            if (live === undefined) {
                const createdArn = yield* bda
                    .createDataAutomationLibrary({
                    libraryName,
                    libraryDescription: news.libraryDescription,
                    encryptionConfiguration: news.encryptionConfiguration,
                    tags: toBdaTagList(desiredTags),
                })
                    .pipe(Effect.map((r) => r.libraryArn), Effect.catchTag("ConflictException", (conflict) => Effect.gen(function* () {
                    const arn = yield* findLibraryArn(libraryName);
                    return arn === undefined
                        ? yield* Effect.fail(conflict)
                        : arn;
                })));
                live =
                    createdArn === undefined
                        ? undefined
                        : yield* observeLibrary(createdArn);
            }
            if (live === undefined) {
                return yield* Effect.fail(new DataAutomationLibraryNotObservable({
                    libraryName,
                    message: `Data Automation library '${libraryName}' was not observable after create`,
                }));
            }
            // 3. SYNC — diff the OBSERVED description against the desired one;
            //    apply the idempotent update only on drift.
            if (unredact(live.libraryDescription ?? "") !==
                (news.libraryDescription ?? "")) {
                yield* bda.updateDataAutomationLibrary({
                    libraryArn: live.libraryArn,
                    libraryDescription: news.libraryDescription ?? "",
                });
                live = (yield* observeLibrary(live.libraryArn)) ?? live;
            }
            // 3b. SYNC TAGS against observed cloud tags.
            yield* syncBdaTags(live.libraryArn, desiredTags);
            yield* session.note(libraryName);
            return toAttributes(live);
        }),
        delete: Effect.fn(function* ({ output }) {
            yield* bda
                .deleteDataAutomationLibrary({ libraryArn: output.libraryArn })
                .pipe(Effect.catchTag("ResourceNotFoundException", () => Effect.void));
            // Deletion settles asynchronously (status ACTIVE → DELETING → gone)
            // and library names are unique, so wait for the terminal
            // disappearance — otherwise an immediate same-name re-create
            // conflicts with the vanishing library. Bounded: 10 × 3s ≈ 30s.
            yield* observeLibrary(output.libraryArn).pipe(repeatUntilLibraryGone);
        }),
    });
}));
//# sourceMappingURL=DataAutomationLibrary.js.map