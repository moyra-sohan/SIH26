import * as sitewise from "@distilled.cloud/aws/iotsitewise";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Schedule from "effect/Schedule";
import * as EffectStream from "effect/Stream";
import { Unowned } from "../../AdoptPolicy.js";
import { isResolved } from "../../Diff.js";
import { createPhysicalName } from "../../PhysicalName.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
import { createInternalTags, hasAlchemyTags } from "../../Tags.js";
import { fetchSiteWiseTags, matchesDesired, syncSiteWiseTags, } from "./internal.js";
/**
 * An AWS IoT SiteWise asset model — a standardized definition of
 * properties (attributes, measurements, transforms, metrics) and
 * hierarchies from which industrial assets are created.
 *
 * Asset model creation and updates are asynchronous
 * (`CREATING`/`UPDATING` → `ACTIVE`); the provider waits for the model to
 * converge to `ACTIVE` before returning.
 *
 * ### Creating Asset Models
 * **Example:** Asset Model with a Measurement and an Attribute
 * ```typescript
 * import * as AWS from "alchemy/AWS";
 *
 * const model = yield* AWS.IoTSiteWise.AssetModel("PumpModel", {
 *   assetModelDescription: "A pump on the factory floor",
 *   assetModelProperties: [
 *     {
 *       name: "SerialNumber",
 *       dataType: "STRING",
 *       type: { attribute: { defaultValue: "unknown" } },
 *     },
 *     {
 *       name: "Temperature",
 *       dataType: "DOUBLE",
 *       unit: "Celsius",
 *       type: { measurement: {} },
 *     },
 *   ],
 * });
 * ```
 *
 * ### Hierarchies
 * **Example:** Parent Model with a Child Hierarchy
 * ```typescript
 * const pump = yield* AWS.IoTSiteWise.AssetModel("PumpModel", {
 *   assetModelProperties: [
 *     { name: "Temperature", dataType: "DOUBLE", type: { measurement: {} } },
 *   ],
 * });
 *
 * const site = yield* AWS.IoTSiteWise.AssetModel("SiteModel", {
 *   assetModelHierarchies: [
 *     { name: "Pumps", childAssetModelId: pump.assetModelId },
 *   ],
 * });
 * ```
 *
 * @resource
 */
export const AssetModel = Resource("AWS.IoTSiteWise.AssetModel");
const createAssetModelName = (id, props) => props.assetModelName
    ? Effect.succeed(props.assetModelName)
    : createPhysicalName({ id, maxLength: 256 });
const readAssetModelById = Effect.fn(function* (assetModelId) {
    const described = yield* sitewise
        .describeAssetModel({ assetModelId, excludeProperties: false })
        .pipe(Effect.catchTag("ResourceNotFoundException", () => Effect.succeed(undefined)));
    if (!described || described.assetModelStatus.state === "DELETING") {
        return undefined;
    }
    const state = {
        described,
        attrs: {
            assetModelId: described.assetModelId,
            assetModelArn: described.assetModelArn,
            assetModelName: described.assetModelName,
            assetModelType: described.assetModelType,
            state: described.assetModelStatus.state,
            tags: yield* fetchSiteWiseTags(described.assetModelArn),
        },
    };
    return state;
});
const findAssetModelByName = Effect.fn(function* (name) {
    const summaries = yield* sitewise.listAssetModels.pages({}).pipe(EffectStream.runCollect, Effect.map((chunk) => Array.from(chunk).flatMap((page) => page.assetModelSummaries)));
    const match = summaries.find((summary) => summary.name === name && summary.status.state !== "DELETING");
    if (!match)
        return undefined;
    return yield* readAssetModelById(match.id);
});
/**
 * An asset model still transitioning toward the awaited state — retried
 * by {@link waitForAssetModelState}'s bounded schedule.
 */
class AssetModelNotReady extends Data.TaggedError("AssetModelNotReady") {
}
/**
 * An asset model whose asynchronous provisioning converged to the
 * terminal `FAILED` state.
 */
export class AssetModelProvisioningFailed extends Data.TaggedError("AssetModelProvisioningFailed") {
}
// Explicitly-typed retry wrapper — an inline `Effect.retry` in provider
// lifecycle code leaks `Retry.Return`'s conditional type into declaration
// emit and widens the provider layer to `unknown` for every consumer of
// `AWS.providers()`.
const retryWhileNotReady = (self) => Effect.retry(self, {
    while: (e) => e._tag === "AssetModelNotReady",
    // Asset model provisioning usually converges in seconds; poll every
    // 3s up to ~90s total.
    schedule: Schedule.max([Schedule.spaced("3 seconds"), Schedule.recurs(30)]),
});
// A delete/update racing an in-flight CREATING/UPDATING transition
// surfaces as ConflictingOperationException — bounded retry through it.
const retryThroughConflictingOperation = (self) => Effect.retry(self, {
    while: (e) => e._tag === "ConflictingOperationException",
    schedule: Schedule.max([Schedule.spaced("5 seconds"), Schedule.recurs(10)]),
});
const waitForAssetModelState = (assetModelId, target) => retryWhileNotReady(Effect.gen(function* () {
    const described = yield* sitewise
        .describeAssetModel({ assetModelId, excludeProperties: true })
        .pipe(Effect.catchTag("ResourceNotFoundException", () => Effect.succeed(undefined)));
    if (target === "DELETED") {
        if (described === undefined)
            return;
        return yield* Effect.fail(new AssetModelNotReady({
            assetModelId,
            state: described.assetModelStatus.state,
        }));
    }
    if (described?.assetModelStatus.state === "ACTIVE")
        return;
    if (described?.assetModelStatus.state === "FAILED") {
        return yield* Effect.fail(new AssetModelProvisioningFailed({
            assetModelId,
            message: described.assetModelStatus.error?.message,
        }));
    }
    return yield* Effect.fail(new AssetModelNotReady({
        assetModelId,
        state: described?.assetModelStatus.state,
    }));
}));
/**
 * Map desired property/hierarchy definitions onto the observed model so
 * an update preserves the service-assigned ids of entries that already
 * exist (matched by name). Entries without a match are sent id-less and
 * get new ids.
 */
const withObservedIds = (desired, observed) => desired.map((item) => {
    if (item.id !== undefined)
        return item;
    const match = observed.find((o) => o.name === item.name);
    return match?.id !== undefined ? { ...item, id: match.id } : item;
});
export const AssetModelProvider = () => Provider.effect(AssetModel, Effect.gen(function* () {
    return {
        stables: ["assetModelId", "assetModelArn"],
        list: () => Effect.gen(function* () {
            const summaries = yield* sitewise.listAssetModels.pages({}).pipe(EffectStream.runCollect, Effect.map((chunk) => Array.from(chunk).flatMap((page) => page.assetModelSummaries)));
            const hydrated = yield* Effect.forEach(summaries.map((s) => s.id), (assetModelId) => readAssetModelById(assetModelId), { concurrency: 5 });
            return hydrated.flatMap((state) => state === undefined ? [] : [state.attrs]);
        }),
        read: Effect.fn(function* ({ id, olds, output }) {
            const state = output?.assetModelId
                ? yield* readAssetModelById(output.assetModelId)
                : yield* findAssetModelByName(yield* createAssetModelName(id, olds ?? {}));
            if (!state)
                return undefined;
            return (yield* hasAlchemyTags(id, state.attrs.tags))
                ? state.attrs
                : Unowned(state.attrs);
        }),
        diff: Effect.fn(function* ({ news, olds }) {
            if (!isResolved(news))
                return;
            if (olds === undefined)
                return;
            // The model type is fixed at creation.
            if ((olds.assetModelType ?? "ASSET_MODEL") !==
                (news.assetModelType ?? "ASSET_MODEL")) {
                return { action: "replace" };
            }
        }),
        reconcile: Effect.fn(function* ({ id, news, output, session }) {
            if (!news) {
                return yield* Effect.fail(new Error("IoT SiteWise AssetModel requires props"));
            }
            const name = yield* createAssetModelName(id, news);
            const internalTags = yield* createInternalTags(id);
            const desiredTags = { ...internalTags, ...news.tags };
            // Observe — prefer the cached id; fall back to a name lookup so
            // a create whose state failed to persist is adopted, not
            // duplicated.
            let state = output?.assetModelId
                ? yield* readAssetModelById(output.assetModelId)
                : yield* findAssetModelByName(name);
            // Ensure — create if missing, then wait for ACTIVE.
            if (state === undefined) {
                const created = yield* sitewise.createAssetModel({
                    assetModelName: name,
                    assetModelType: news.assetModelType,
                    assetModelDescription: news.assetModelDescription,
                    assetModelProperties: news.assetModelProperties,
                    assetModelHierarchies: news.assetModelHierarchies,
                    assetModelCompositeModels: news.assetModelCompositeModels,
                    tags: desiredTags,
                });
                yield* session.note(`Creating asset model ${name} (${created.assetModelId})...`);
                yield* waitForAssetModelState(created.assetModelId, "ACTIVE");
                state = yield* readAssetModelById(created.assetModelId);
                if (state === undefined) {
                    return yield* Effect.fail(new Error(`failed to read created asset model ${name}`));
                }
            }
            // Sync — diff observed definition against desired; UpdateAssetModel
            // replaces the full definition, so send the complete desired set
            // with observed ids preserved by name.
            const described = state.described;
            const desiredProperties = withObservedIds(news.assetModelProperties ?? [], described.assetModelProperties);
            const desiredHierarchies = withObservedIds(news.assetModelHierarchies ?? [], described.assetModelHierarchies);
            const observedDefinition = {
                name: described.assetModelName,
                description: described.assetModelDescription,
                properties: described.assetModelProperties,
                hierarchies: described.assetModelHierarchies,
            };
            const desiredDefinition = {
                name,
                description: news.assetModelDescription ?? "",
                properties: desiredProperties,
                hierarchies: desiredHierarchies,
            };
            const definitionDrifted = name !== described.assetModelName ||
                (news.assetModelDescription ?? "") !==
                    described.assetModelDescription ||
                desiredProperties.length !==
                    described.assetModelProperties.length ||
                desiredHierarchies.length !==
                    described.assetModelHierarchies.length ||
                !matchesDesired(desiredDefinition, observedDefinition);
            if (definitionDrifted) {
                yield* retryThroughConflictingOperation(sitewise.updateAssetModel({
                    assetModelId: state.attrs.assetModelId,
                    assetModelName: name,
                    assetModelDescription: news.assetModelDescription,
                    assetModelProperties: desiredProperties,
                    assetModelHierarchies: desiredHierarchies,
                }));
                yield* waitForAssetModelState(state.attrs.assetModelId, "ACTIVE");
                yield* session.note(`Updated asset model ${name}`);
            }
            // Sync tags — diff against observed cloud tags.
            yield* syncSiteWiseTags(state.attrs.assetModelArn, state.attrs.tags, desiredTags);
            yield* session.note(state.attrs.assetModelArn);
            const final = yield* readAssetModelById(state.attrs.assetModelId);
            if (!final) {
                return yield* Effect.fail(new Error(`failed to read reconciled asset model ${name}`));
            }
            return final.attrs;
        }),
        delete: Effect.fn(function* ({ output }) {
            // Deleting while assets still reference the model (or while a
            // prior transition is settling) raises
            // ConflictingOperationException — retry through the window.
            yield* retryThroughConflictingOperation(sitewise
                .deleteAssetModel({ assetModelId: output.assetModelId })
                .pipe(Effect.catchTag("ResourceNotFoundException", () => Effect.void)));
            yield* waitForAssetModelState(output.assetModelId, "DELETED");
        }),
    };
}));
//# sourceMappingURL=AssetModel.js.map