import * as bda from "@distilled.cloud/aws/bedrock-data-automation";
import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";
import { Unowned } from "../../AdoptPolicy.js";
import { isResolved } from "../../Diff.js";
import { createPhysicalName } from "../../PhysicalName.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
import { createInternalTags, hasAlchemyTags } from "../../Tags.js";
import { readBdaTags, syncBdaTags, toBdaTagList, unredact, } from "./internal.js";
/**
 * An Amazon Bedrock Data Automation Blueprint — a JSON schema describing the
 * custom output fields to extract from documents, images, audio, or video.
 * Attach blueprints to a `DataAutomationProject` via its
 * `customOutputConfiguration`.
 *
 * ### Creating Blueprints
 * **Example:** Document blueprint with custom fields
 * ```typescript
 * import * as BDA from "alchemy/AWS/BedrockDataAutomation";
 *
 * const blueprint = yield* BDA.Blueprint("InvoiceBlueprint", {
 *   type: "DOCUMENT",
 *   schema: JSON.stringify({
 *     $schema: "http://json-schema.org/draft-07/schema#",
 *     description: "Extract invoice fields",
 *     class: "invoice",
 *     type: "object",
 *     properties: {
 *       invoice_number: {
 *         type: "string",
 *         inferenceType: "explicit",
 *         instruction: "The invoice number",
 *       },
 *     },
 *   }),
 * });
 * ```
 *
 * **Example:** Attach a blueprint to a project
 * ```typescript
 * const project = yield* BDA.DataAutomationProject("Docs", {
 *   standardOutputConfiguration: {},
 *   customOutputConfiguration: {
 *     blueprints: [{ blueprintArn: blueprint.blueprintArn }],
 *   },
 * });
 * ```
 *
 * @resource
 */
export const Blueprint = Resource("AWS.BedrockDataAutomation.Blueprint");
export const BlueprintProvider = () => Provider.effect(Blueprint, Effect.gen(function* () {
    const createName = Effect.fn(function* (id, props) {
        return (props.blueprintName ??
            (yield* createPhysicalName({ id, maxLength: 128 })));
    });
    const toAttributes = (blueprint) => ({
        blueprintArn: blueprint.blueprintArn,
        blueprintName: unredact(blueprint.blueprintName),
        blueprintStage: blueprint.blueprintStage ?? "LIVE",
        type: blueprint.type,
    });
    const observeBlueprint = Effect.fn(function* (blueprintArn, blueprintStage) {
        return yield* bda.getBlueprint({ blueprintArn, blueprintStage }).pipe(Effect.map((r) => r.blueprint), Effect.catchTag("ResourceNotFoundException", () => Effect.succeed(undefined)));
    });
    const findBlueprintArn = Effect.fn(function* (name) {
        const summaries = yield* bda.listBlueprints
            .items({ resourceOwner: "ACCOUNT" })
            .pipe(Stream.runCollect);
        return Array.from(summaries).find((s) => s.blueprintName !== undefined && unredact(s.blueprintName) === name)?.blueprintArn;
    });
    return Blueprint.Provider.of({
        stables: ["blueprintArn", "blueprintName", "type"],
        list: () => Effect.gen(function* () {
            const summaries = yield* bda.listBlueprints
                .items({ resourceOwner: "ACCOUNT" })
                .pipe(Stream.runCollect);
            const attrs = yield* Effect.forEach(Array.from(summaries), (s) => observeBlueprint(s.blueprintArn, s.blueprintStage).pipe(Effect.map((blueprint) => blueprint === undefined ? [] : [toAttributes(blueprint)])), { concurrency: 5 });
            return attrs.flat();
        }),
        read: Effect.fn(function* ({ id, olds, output }) {
            const blueprintArn = output?.blueprintArn ??
                (yield* findBlueprintArn(yield* createName(id, olds ?? {})));
            if (blueprintArn === undefined)
                return undefined;
            const found = yield* observeBlueprint(blueprintArn, olds?.blueprintStage);
            if (found === undefined)
                return undefined;
            const attrs = toAttributes(found);
            const tags = yield* readBdaTags(blueprintArn);
            return (yield* hasAlchemyTags(id, tags)) ? attrs : Unowned(attrs);
        }),
        diff: Effect.fn(function* ({ id, news, olds }) {
            if (!isResolved(news))
                return undefined;
            const oldName = yield* createName(id, olds ?? {});
            const newName = yield* createName(id, news ?? {});
            if (oldName !== newName ||
                olds?.type !== news.type ||
                olds?.blueprintStage !== news.blueprintStage) {
                return { action: "replace" };
            }
            // fall through: engine default update logic for mutable fields
        }),
        reconcile: Effect.fn(function* ({ id, news, output, session }) {
            const blueprintName = output?.blueprintName ?? (yield* createName(id, news));
            const internalTags = yield* createInternalTags(id);
            const desiredTags = { ...news.tags, ...internalTags };
            // 1. OBSERVE — cloud state is authoritative; output caches the ARN.
            const cachedArn = output?.blueprintArn ?? (yield* findBlueprintArn(blueprintName));
            let live = cachedArn === undefined
                ? undefined
                : yield* observeBlueprint(cachedArn, news.blueprintStage);
            // 2. ENSURE — create when missing; a concurrent create surfaces as
            //    the typed ConflictException, which we treat as a race and
            //    re-observe by name.
            if (live === undefined) {
                live = yield* bda
                    .createBlueprint({
                    blueprintName,
                    type: news.type,
                    schema: news.schema,
                    blueprintStage: news.blueprintStage,
                    encryptionConfiguration: news.encryptionConfiguration,
                    tags: toBdaTagList(desiredTags),
                })
                    .pipe(Effect.map((r) => r.blueprint), Effect.catchTag("ConflictException", (conflict) => Effect.gen(function* () {
                    const arn = yield* findBlueprintArn(blueprintName);
                    const observed = arn === undefined
                        ? undefined
                        : yield* observeBlueprint(arn, news.blueprintStage);
                    return observed === undefined
                        ? yield* Effect.fail(conflict)
                        : observed;
                })));
            }
            // 3. SYNC — diff the OBSERVED schema and encryption key against the
            //    desired state; apply the idempotent PUT only on drift.
            const kmsDrift = news.encryptionConfiguration !== undefined &&
                live.kmsKeyId !== news.encryptionConfiguration.kmsKeyId;
            if (unredact(live.schema) !== news.schema || kmsDrift) {
                live = yield* bda
                    .updateBlueprint({
                    blueprintArn: live.blueprintArn,
                    schema: news.schema,
                    blueprintStage: news.blueprintStage,
                    encryptionConfiguration: news.encryptionConfiguration,
                })
                    .pipe(Effect.map((r) => r.blueprint));
            }
            // 3b. SYNC TAGS against observed cloud tags.
            yield* syncBdaTags(live.blueprintArn, desiredTags);
            yield* session.note(blueprintName);
            return toAttributes(live);
        }),
        delete: Effect.fn(function* ({ output }) {
            // Versions (immutable snapshots, e.g. from CreateBlueprintVersion)
            // block deletion of the blueprint itself — delete them first.
            // NOTE: the blueprintArn filter cannot be combined with other
            // filters ("Invalid List filter combination").
            const versions = yield* bda.listBlueprints
                .items({ blueprintArn: output.blueprintArn })
                .pipe(Stream.runCollect, Effect.map((summaries) => Array.from(summaries)
                .map((s) => s.blueprintVersion)
                .filter((v) => v !== undefined)), Effect.catchTag("ResourceNotFoundException", () => Effect.succeed([])));
            yield* Effect.forEach(versions, (blueprintVersion) => bda
                .deleteBlueprint({
                blueprintArn: output.blueprintArn,
                blueprintVersion,
            })
                .pipe(Effect.catchTag("ResourceNotFoundException", () => Effect.void)), { concurrency: 1 });
            yield* bda
                .deleteBlueprint({ blueprintArn: output.blueprintArn })
                .pipe(Effect.catchTag("ResourceNotFoundException", () => Effect.void));
        }),
    });
}));
//# sourceMappingURL=Blueprint.js.map