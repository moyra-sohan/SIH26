import * as omics from "@distilled.cloud/aws/omics";
import * as Effect from "effect/Effect";
import * as Schedule from "effect/Schedule";
import * as Stream from "effect/Stream";
import { Unowned } from "../../AdoptPolicy.js";
import { isResolved } from "../../Diff.js";
import { createPhysicalName } from "../../PhysicalName.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
import { createInternalTags, hasAlchemyTags, tagRecord } from "../../Tags.js";
import { syncOmicsTags } from "./internal.js";
// Annotation/variant store names must match `[a-z]([a-z0-9_]){0,254}` — the
// generated physical name (hyphens, mixed case) is coerced to fit.
const toStoreName = (raw) => {
    const sanitized = raw.toLowerCase().replace(/[^a-z0-9_]/g, "_");
    const prefixed = /^[a-z]/.test(sanitized) ? sanitized : `a${sanitized}`;
    return prefixed.slice(0, 255);
};
/**
 * An Amazon HealthOmics annotation store — a container for genome annotation
 * data (GFF, TSV, or VCF) aligned to a reference genome.
 *
 * An annotation store name is auto-generated from the app, stage, and logical
 * ID unless you provide one. The `storeFormat`, `reference`, `storeOptions`,
 * and `sseConfig` are immutable — changing any of them replaces the store.
 * `description` is updated in place.
 * ### Creating an Annotation Store
 * **Example:** VCF Annotation Store
 * ```typescript
 * import * as Omics from "alchemy/AWS/Omics";
 *
 * const store = yield* Omics.AnnotationStore("Annotations", {
 *   storeFormat: "VCF",
 *   reference: {
 *     referenceArn: "arn:aws:omics:us-east-1:123456789012:referenceStore/1234567890/reference/0987654321",
 *   },
 * });
 * ```
 *
 * **Example:** TSV Annotation Store
 * ```typescript
 * const store = yield* Omics.AnnotationStore("Annotations", {
 *   storeFormat: "TSV",
 *   storeOptions: {
 *     tsvStoreOptions: { annotationType: "GENERIC" },
 *   },
 * });
 * ```
 *
 * @resource
 */
export const AnnotationStore = Resource("AWS.Omics.AnnotationStore");
export const AnnotationStoreProvider = () => Provider.effect(AnnotationStore, Effect.gen(function* () {
    const createName = Effect.fn(function* (id, props) {
        return (props.name ??
            toStoreName(yield* createPhysicalName({ id, maxLength: 96 })));
    });
    const waitUntilActive = Effect.fn(function* (name) {
        const final = yield* omics.getAnnotationStore({ name }).pipe(Effect.repeat({
            schedule: Schedule.max([
                Schedule.fixed("5 seconds"),
                Schedule.recurs(23),
            ]),
            until: (s) => s.status === "ACTIVE" || s.status === "FAILED",
        }));
        if (final.status === "FAILED") {
            return yield* Effect.fail(new omics.ValidationException({
                message: `Annotation store ${name} failed: ${final.statusMessage ?? "unknown"}`,
            }));
        }
        return final;
    });
    return AnnotationStore.Provider.of({
        stables: ["annotationStoreId", "annotationStoreArn", "name"],
        list: () => omics.listAnnotationStores.items({}).pipe(Stream.map((item) => ({
            annotationStoreId: item.id,
            annotationStoreArn: item.storeArn,
            name: item.name ?? "",
            status: item.status ?? "",
        })), Stream.runCollect, Effect.map((chunk) => Array.from(chunk))),
        read: Effect.fn(function* ({ id, olds, output }) {
            const name = output?.name ?? (yield* createName(id, olds ?? {}));
            const found = yield* omics
                .getAnnotationStore({ name })
                .pipe(Effect.catchTag("ResourceNotFoundException", () => Effect.succeed(undefined)));
            if (found === undefined)
                return undefined;
            const attrs = {
                annotationStoreId: found.id,
                annotationStoreArn: found.storeArn,
                name: found.name,
                status: found.status,
            };
            return (yield* hasAlchemyTags(id, tagRecord(found.tags)))
                ? attrs
                : Unowned(attrs);
        }),
        diff: Effect.fn(function* ({ id, news, olds }) {
            if (!isResolved(news))
                return undefined;
            const prev = olds ?? {};
            const oldName = yield* createName(id, prev);
            const newName = yield* createName(id, news);
            if (oldName !== newName)
                return { action: "replace" };
            if ((prev.storeFormat ?? "") !== (news.storeFormat ?? "") ||
                (prev.reference?.referenceArn ?? "") !==
                    (news.reference?.referenceArn ?? "") ||
                prev.sseConfig?.type !== news.sseConfig?.type ||
                prev.sseConfig?.keyArn !== news.sseConfig?.keyArn) {
                return { action: "replace" };
            }
        }),
        reconcile: Effect.fn(function* ({ id, news, output, session }) {
            const name = output?.name ?? (yield* createName(id, news));
            const internalTags = yield* createInternalTags(id);
            const desiredTags = { ...news.tags, ...internalTags };
            // OBSERVE — annotation stores are addressable by name.
            let store = yield* omics
                .getAnnotationStore({ name })
                .pipe(Effect.catchTag("ResourceNotFoundException", () => Effect.succeed(undefined)));
            // ENSURE — create if missing, tolerating a create race, then wait
            // for the async provisioning to reach a terminal state.
            if (store === undefined) {
                yield* omics
                    .createAnnotationStore({
                    name,
                    description: news.description,
                    storeFormat: news.storeFormat,
                    reference: news.reference,
                    storeOptions: news.storeOptions,
                    sseConfig: news.sseConfig,
                    tags: desiredTags,
                })
                    .pipe(Effect.catchTag("ConflictException", () => Effect.void));
                store = yield* waitUntilActive(name);
            }
            else if (store.status === "CREATING") {
                store = yield* waitUntilActive(name);
            }
            // SYNC — description is the only mutable field.
            if (news.description !== undefined &&
                news.description !== store.description) {
                yield* omics.updateAnnotationStore({
                    name,
                    description: news.description,
                });
                store = yield* omics.getAnnotationStore({ name });
            }
            // SYNC TAGS — diff against observed cloud tags so adoption converges.
            yield* syncOmicsTags(store.storeArn, desiredTags);
            yield* session.note(store.id);
            return {
                annotationStoreId: store.id,
                annotationStoreArn: store.storeArn,
                name: store.name,
                status: store.status,
            };
        }),
        delete: Effect.fn(function* ({ output }) {
            yield* omics
                .deleteAnnotationStore({ name: output.name, force: true })
                .pipe(Effect.catchTag("ResourceNotFoundException", () => Effect.void));
        }),
    });
}));
//# sourceMappingURL=AnnotationStore.js.map