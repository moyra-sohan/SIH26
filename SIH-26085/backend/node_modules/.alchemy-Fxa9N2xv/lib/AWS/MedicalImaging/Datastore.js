import * as medicalimaging from "@distilled.cloud/aws/medical-imaging";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Schedule from "effect/Schedule";
import * as Stream from "effect/Stream";
import { Unowned } from "../../AdoptPolicy.js";
import { isResolved } from "../../Diff.js";
import { createPhysicalName } from "../../PhysicalName.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
import { createInternalTags, diffTags, hasAlchemyTags } from "../../Tags.js";
/**
 * An AWS HealthImaging data store — a HIPAA-eligible store for DICOM P10
 * medical images with sub-second image-frame retrieval.
 *
 * Data stores provision asynchronously (CREATING → ACTIVE, typically a few
 * minutes) and must be empty (no image sets) before they can be deleted.
 * HealthImaging has no update API, so every property except tags triggers a
 * replacement.
 * ### Creating a Data Store
 * **Example:** Basic Data Store
 * ```typescript
 * const datastore = yield* Datastore("Imaging", {});
 * ```
 *
 * **Example:** Data Store with a Customer-Managed KMS Key
 * ```typescript
 * const datastore = yield* Datastore("Imaging", {
 *   kmsKeyArn: key.keyArn,
 *   tags: { team: "radiology" },
 * });
 * ```
 *
 * ### Importing DICOM Data
 * **Example:** Reference the Data Store Id
 * ```typescript
 * const datastore = yield* Datastore("Imaging", {});
 * // startDICOMImportJob and image-set APIs address the store by id
 * const id = datastore.datastoreId;
 * ```
 *
 * @resource
 */
export const Datastore = Resource("AWS.MedicalImaging.Datastore");
/**
 * Raised when a data store never reaches `ACTIVE` (or its create fails)
 * within the bounded provisioning wait.
 */
export class DatastoreNotReady extends Data.TaggedError("DatastoreNotReady") {
}
/**
 * Raised when the HealthImaging API omits an expected field (e.g. the
 * data store ARN) from a response.
 */
export class DatastoreIncomplete extends Data.TaggedError("DatastoreIncomplete") {
}
/** CreateDatastore requires a client token; derive it from the instance id
 * so engine retries of the same instance are idempotent. */
const createToken = (instanceId) => instanceId.replaceAll(/[^a-zA-Z0-9]/g, "").slice(0, 64) || "alchemy";
/** Provisioning typically completes in a few minutes; budget 40 × 15s. */
const retryWhileNotReady = (self) => Effect.retry(self, {
    while: (e) => e._tag === "DatastoreNotReady",
    schedule: Schedule.max([Schedule.fixed("15 seconds"), Schedule.recurs(40)]),
});
/** A data store mid-create rejects deletion with ConflictException — retry
 * (bounded) while it settles. */
const retryWhileConflict = (self) => Effect.retry(self, {
    while: (e) => e._tag === "ConflictException",
    schedule: Schedule.max([Schedule.fixed("15 seconds"), Schedule.recurs(20)]),
});
const toTagRecord = (tags) => Object.fromEntries(Object.entries(tags ?? {}).filter((entry) => entry[1] !== undefined));
export const DatastoreProvider = () => Provider.effect(Datastore, Effect.gen(function* () {
    const toName = (id, props) => props.datastoreName
        ? Effect.succeed(props.datastoreName)
        : createPhysicalName({ id, maxLength: 64 });
    const getById = Effect.fn(function* (datastoreId) {
        const response = yield* medicalimaging
            .getDatastore({ datastoreId })
            .pipe(Effect.catchTag("ResourceNotFoundException", () => Effect.succeed(undefined)));
        const properties = response?.datastoreProperties;
        if (properties === undefined)
            return undefined;
        if (properties.datastoreStatus === "DELETED" ||
            properties.datastoreStatus === "DELETING") {
            return undefined;
        }
        return properties;
    });
    // Data stores are addressed by a server-generated id; a name-based
    // lookup scans the paginated list (names are not unique — take the
    // first live match).
    const findByName = Effect.fn(function* (name) {
        const matches = yield* medicalimaging.listDatastores.items({}).pipe(Stream.filter((summary) => summary.datastoreName === name &&
            summary.datastoreStatus !== "DELETED" &&
            summary.datastoreStatus !== "DELETING"), Stream.take(1), Stream.runCollect);
        const summary = Array.from(matches)[0];
        if (summary === undefined)
            return undefined;
        return yield* getById(summary.datastoreId);
    });
    const observe = Effect.fn(function* (datastoreId, name) {
        if (datastoreId !== undefined) {
            const properties = yield* getById(datastoreId);
            if (properties !== undefined)
                return properties;
        }
        return yield* findByName(name);
    });
    const requireArn = Effect.fn(function* (properties) {
        if (properties.datastoreArn === undefined) {
            return yield* Effect.fail(new DatastoreIncomplete({
                message: `data store '${properties.datastoreId}' has no ARN in the GetDatastore response`,
            }));
        }
        return properties.datastoreArn;
    });
    const readTags = Effect.fn(function* (arn) {
        const response = yield* medicalimaging
            .listTagsForResource({ resourceArn: arn })
            .pipe(Effect.catch(() => Effect.succeed(undefined)));
        return toTagRecord(response?.tags);
    });
    const toAttrs = Effect.fn(function* (properties) {
        const arn = yield* requireArn(properties);
        return {
            datastoreId: properties.datastoreId,
            datastoreName: properties.datastoreName,
            datastoreArn: arn,
            datastoreStatus: properties.datastoreStatus,
            kmsKeyArn: properties.kmsKeyArn,
            tags: yield* readTags(arn),
        };
    });
    const waitForActive = Effect.fn(function* (datastoreId) {
        return yield* Effect.gen(function* () {
            const properties = yield* getById(datastoreId);
            if (properties === undefined) {
                return yield* Effect.fail(new DatastoreNotReady({
                    message: `data store '${datastoreId}' disappeared while waiting for ACTIVE`,
                }));
            }
            if (properties.datastoreStatus === "CREATE_FAILED") {
                return yield* Effect.fail(new DatastoreIncomplete({
                    message: `data store '${datastoreId}' failed to create (status: CREATE_FAILED)`,
                }));
            }
            if (properties.datastoreStatus !== "ACTIVE") {
                return yield* Effect.fail(new DatastoreNotReady({
                    message: `data store '${datastoreId}' not active (status: ${properties.datastoreStatus})`,
                }));
            }
            return properties;
        }).pipe(retryWhileNotReady);
    });
    return {
        stables: ["datastoreId", "datastoreArn", "datastoreName"],
        diff: Effect.fn(function* ({ id, olds, news }) {
            if (!isResolved(news))
                return undefined;
            const n = news;
            const o = olds;
            if (n === undefined || o === undefined)
                return undefined;
            // HealthImaging has no UpdateDatastore — every property except
            // tags is create-only and forces a replacement.
            if ((yield* toName(id, o)) !== (yield* toName(id, n))) {
                return { action: "replace" };
            }
            if ((n.kmsKeyArn ?? undefined) !== (o.kmsKeyArn ?? undefined)) {
                return { action: "replace" };
            }
            if ((n.lambdaAuthorizerArn ?? undefined) !==
                (o.lambdaAuthorizerArn ?? undefined)) {
                return { action: "replace" };
            }
            if ((n.losslessStorageFormat ?? undefined) !==
                (o.losslessStorageFormat ?? undefined)) {
                return { action: "replace" };
            }
            // tags → default update
        }),
        read: Effect.fn(function* ({ id, olds, output }) {
            const name = output?.datastoreName ?? (yield* toName(id, olds ?? {}));
            const properties = yield* observe(output?.datastoreId, name);
            if (properties === undefined)
                return undefined;
            const attrs = yield* toAttrs(properties);
            return (yield* hasAlchemyTags(id, attrs.tags))
                ? attrs
                : Unowned(attrs);
        }),
        reconcile: Effect.fn(function* ({ id, news, output, session, instanceId, }) {
            const props = news;
            const name = output?.datastoreName ?? (yield* toName(id, props));
            const internalTags = yield* createInternalTags(id);
            const desiredTags = { ...props.tags, ...internalTags };
            // 1. OBSERVE — cloud state is authoritative; output is only an
            // id cache.
            let observed = yield* observe(output?.datastoreId, name);
            // 2. ENSURE — create if missing; a ConflictException is a create
            // race (or a leftover CREATE_FAILED store), resolved by re-reading.
            if (observed === undefined) {
                const created = yield* medicalimaging
                    .createDatastore({
                    datastoreName: name,
                    clientToken: createToken(instanceId),
                    kmsKeyArn: props.kmsKeyArn,
                    lambdaAuthorizerArn: props.lambdaAuthorizerArn,
                    losslessStorageFormat: props.losslessStorageFormat,
                    tags: desiredTags,
                })
                    .pipe(Effect.catchTag("ConflictException", () => Effect.succeed(undefined)));
                observed =
                    created !== undefined
                        ? yield* getById(created.datastoreId)
                        : yield* findByName(name);
            }
            if (observed === undefined) {
                return yield* Effect.fail(new DatastoreIncomplete({
                    message: `data store '${name}' not found after create`,
                }));
            }
            // Provisioning is async (CREATING → ACTIVE); wait bounded so tag
            // syncs and dependents see an ACTIVE store.
            observed = yield* waitForActive(observed.datastoreId);
            const arn = yield* requireArn(observed);
            // 3. SYNC TAGS — diff against OBSERVED cloud tags.
            const observedTags = yield* readTags(arn);
            const { removed, upsert } = diffTags(observedTags, desiredTags);
            if (upsert.length > 0) {
                yield* medicalimaging.tagResource({
                    resourceArn: arn,
                    tags: Object.fromEntries(upsert.map((tag) => [tag.Key, tag.Value])),
                });
            }
            if (removed.length > 0) {
                yield* medicalimaging.untagResource({
                    resourceArn: arn,
                    tagKeys: removed,
                });
            }
            yield* session.note(observed.datastoreId);
            return yield* toAttrs(observed);
        }),
        delete: Effect.fn(function* ({ output }) {
            // Already deleting or gone is success; a store mid-create rejects
            // deletion with ConflictException (retried, bounded). A non-empty
            // store also raises ConflictException and surfaces the typed error
            // once the retry budget is exhausted.
            const observed = yield* medicalimaging
                .getDatastore({ datastoreId: output.datastoreId })
                .pipe(Effect.catchTag("ResourceNotFoundException", () => Effect.succeed(undefined)));
            const status = observed?.datastoreProperties.datastoreStatus;
            if (status === undefined ||
                status === "DELETING" ||
                status === "DELETED") {
                return;
            }
            yield* medicalimaging
                .deleteDatastore({ datastoreId: output.datastoreId })
                .pipe(Effect.catchTag("ResourceNotFoundException", () => Effect.void), retryWhileConflict);
        }),
        list: () => medicalimaging.listDatastores.items({}).pipe(Stream.filter((summary) => summary.datastoreStatus !== "DELETED" &&
            summary.datastoreStatus !== "DELETING"), Stream.runCollect, Effect.flatMap((summaries) => Effect.forEach(Array.from(summaries), (summary) => getById(summary.datastoreId).pipe(Effect.flatMap((properties) => properties === undefined
            ? Effect.succeed(undefined)
            : toAttrs(properties))), { concurrency: 4 })), Effect.map((attrs) => attrs.filter((a) => a !== undefined))),
    };
}));
//# sourceMappingURL=Datastore.js.map