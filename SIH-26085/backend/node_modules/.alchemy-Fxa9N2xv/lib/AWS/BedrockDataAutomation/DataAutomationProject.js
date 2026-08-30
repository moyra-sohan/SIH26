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
import { bdaConfigEquals, readBdaTags, syncBdaTags, toBdaTagList, unredact, } from "./internal.js";
// Explicitly-typed pipeable repeat helper. Inlining `Effect.repeat` in a
// provider lifecycle op leaks its conditional return type into declaration
// emit and widens the provider layer for every consumer of `AWS.providers()`.
const repeatUntilProjectSettled = (self) => Effect.repeat(self, {
    schedule: Schedule.fixed("3 seconds"),
    until: (project) => project === undefined || project.status !== "IN_PROGRESS",
    times: 25,
});
/**
 * An Amazon Bedrock Data Automation Project — the configuration unit that
 * turns documents, images, audio, and video into structured output, with
 * optional custom output driven by `Blueprint`s.
 *
 * ### Creating Projects
 * **Example:** Project with default standard output
 * ```typescript
 * import * as BDA from "alchemy/AWS/BedrockDataAutomation";
 *
 * const project = yield* BDA.DataAutomationProject("Docs", {
 *   standardOutputConfiguration: {},
 * });
 * ```
 *
 * **Example:** Document project with granular extraction
 * ```typescript
 * const project = yield* BDA.DataAutomationProject("Docs", {
 *   projectDescription: "invoice pipeline",
 *   standardOutputConfiguration: {
 *     document: {
 *       extraction: {
 *         granularity: { types: ["DOCUMENT", "PAGE"] },
 *         boundingBox: { state: "DISABLED" },
 *       },
 *       generativeField: { state: "DISABLED" },
 *       outputFormat: {
 *         textFormat: { types: ["MARKDOWN"] },
 *         additionalFileFormat: { state: "DISABLED" },
 *       },
 *     },
 *   },
 * });
 * ```
 *
 * ### Custom Output
 * **Example:** Attach blueprints for custom output
 * ```typescript
 * const blueprint = yield* BDA.Blueprint("InvoiceBlueprint", {
 *   type: "DOCUMENT",
 *   schema: invoiceSchemaJson,
 * });
 *
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
export const DataAutomationProject = Resource("AWS.BedrockDataAutomation.DataAutomationProject");
/**
 * Raised when a Data Automation project reaches the terminal `FAILED` status
 * during provisioning or update.
 */
export class DataAutomationProjectFailed extends Data.TaggedError("DataAutomationProjectFailed") {
}
export const DataAutomationProjectProvider = () => Provider.effect(DataAutomationProject, Effect.gen(function* () {
    const createName = Effect.fn(function* (id, props) {
        return (props.projectName ??
            (yield* createPhysicalName({ id, maxLength: 128 })));
    });
    const toAttributes = (project) => ({
        projectArn: project.projectArn,
        projectName: unredact(project.projectName),
        projectStage: project.projectStage ?? "LIVE",
        status: project.status,
    });
    const observeProject = Effect.fn(function* (projectArn, projectStage) {
        return yield* bda
            .getDataAutomationProject({ projectArn, projectStage })
            .pipe(Effect.map((r) => r.project), Effect.catchTag("ResourceNotFoundException", () => Effect.succeed(undefined)));
    });
    const findProjectArn = Effect.fn(function* (name) {
        const summaries = yield* bda.listDataAutomationProjects
            .items({ resourceOwner: "ACCOUNT" })
            .pipe(Stream.runCollect);
        return Array.from(summaries).find((s) => s.projectName !== undefined && unredact(s.projectName) === name)?.projectArn;
    });
    // Project create/update settle asynchronously (status IN_PROGRESS →
    // COMPLETED | FAILED). Bounded poll: 25 × 3s ≈ 75s worst case.
    const waitForSettled = Effect.fn(function* (projectArn, projectStage) {
        const settled = yield* observeProject(projectArn, projectStage).pipe(repeatUntilProjectSettled);
        if (settled !== undefined && settled.status === "FAILED") {
            return yield* Effect.fail(new DataAutomationProjectFailed({
                projectArn,
                message: `Data Automation project '${projectArn}' reached status FAILED`,
            }));
        }
        return settled;
    });
    return DataAutomationProject.Provider.of({
        stables: ["projectArn", "projectName"],
        list: () => Effect.gen(function* () {
            const summaries = yield* bda.listDataAutomationProjects
                .items({ resourceOwner: "ACCOUNT" })
                .pipe(Stream.runCollect);
            const attrs = yield* Effect.forEach(Array.from(summaries), (s) => observeProject(s.projectArn, s.projectStage).pipe(Effect.map((project) => project === undefined ? [] : [toAttributes(project)])), { concurrency: 5 });
            return attrs.flat();
        }),
        read: Effect.fn(function* ({ id, olds, output }) {
            const projectArn = output?.projectArn ??
                (yield* findProjectArn(yield* createName(id, olds ?? {})));
            if (projectArn === undefined)
                return undefined;
            const found = yield* observeProject(projectArn, olds?.projectStage);
            if (found === undefined)
                return undefined;
            const attrs = toAttributes(found);
            const tags = yield* readBdaTags(projectArn);
            return (yield* hasAlchemyTags(id, tags)) ? attrs : Unowned(attrs);
        }),
        diff: Effect.fn(function* ({ id, news, olds }) {
            if (!isResolved(news))
                return undefined;
            const oldName = yield* createName(id, olds ?? {});
            const newName = yield* createName(id, news ?? {});
            if (oldName !== newName ||
                olds?.projectStage !== news.projectStage ||
                olds?.projectType !== news.projectType) {
                return { action: "replace" };
            }
            // fall through: engine default update logic for mutable fields
        }),
        reconcile: Effect.fn(function* ({ id, news, output, session }) {
            const projectName = output?.projectName ?? (yield* createName(id, news));
            const internalTags = yield* createInternalTags(id);
            const desiredTags = { ...news.tags, ...internalTags };
            // 1. OBSERVE — cloud state is authoritative; output caches the ARN.
            const cachedArn = output?.projectArn ?? (yield* findProjectArn(projectName));
            let live = cachedArn === undefined
                ? undefined
                : yield* observeProject(cachedArn, news.projectStage);
            // 2. ENSURE — create when missing; a concurrent create surfaces as
            //    the typed ConflictException, which we treat as a race and
            //    re-observe by name. Wait for the async provisioning to settle.
            if (live === undefined) {
                const projectArn = yield* bda
                    .createDataAutomationProject({
                    projectName,
                    projectDescription: news.projectDescription,
                    projectStage: news.projectStage,
                    projectType: news.projectType,
                    standardOutputConfiguration: news.standardOutputConfiguration,
                    customOutputConfiguration: news.customOutputConfiguration,
                    overrideConfiguration: news.overrideConfiguration,
                    dataAutomationLibraryConfiguration: news.dataAutomationLibraryConfiguration,
                    encryptionConfiguration: news.encryptionConfiguration,
                    tags: toBdaTagList(desiredTags),
                })
                    .pipe(Effect.map((r) => r.projectArn), Effect.catchTag("ConflictException", (conflict) => Effect.gen(function* () {
                    const arn = yield* findProjectArn(projectName);
                    return arn === undefined
                        ? yield* Effect.fail(conflict)
                        : arn;
                })));
                live = yield* waitForSettled(projectArn, news.projectStage);
            }
            if (live === undefined) {
                return yield* Effect.fail(new DataAutomationProjectFailed({
                    projectArn: cachedArn ?? projectName,
                    message: `Data Automation project '${projectName}' was not observable after create`,
                }));
            }
            // 3. SYNC — diff OBSERVED configuration against desired; apply the
            //    idempotent PUT only on drift. The server may fill defaulted
            //    fields, in which case the PUT re-applies harmlessly.
            const drift = unredact(live.projectDescription ?? "") !==
                (news.projectDescription ?? "") ||
                !bdaConfigEquals(live.standardOutputConfiguration, news.standardOutputConfiguration) ||
                (news.customOutputConfiguration !== undefined &&
                    !bdaConfigEquals(live.customOutputConfiguration, news.customOutputConfiguration)) ||
                (news.overrideConfiguration !== undefined &&
                    !bdaConfigEquals(live.overrideConfiguration, news.overrideConfiguration)) ||
                (news.encryptionConfiguration !== undefined &&
                    live.kmsKeyId !== news.encryptionConfiguration.kmsKeyId);
            if (drift) {
                yield* bda.updateDataAutomationProject({
                    projectArn: live.projectArn,
                    projectStage: news.projectStage,
                    projectDescription: news.projectDescription,
                    standardOutputConfiguration: news.standardOutputConfiguration,
                    customOutputConfiguration: news.customOutputConfiguration,
                    overrideConfiguration: news.overrideConfiguration,
                    dataAutomationLibraryConfiguration: news.dataAutomationLibraryConfiguration,
                    encryptionConfiguration: news.encryptionConfiguration,
                });
                live =
                    (yield* waitForSettled(live.projectArn, news.projectStage)) ??
                        live;
            }
            // 3b. SYNC TAGS against observed cloud tags.
            yield* syncBdaTags(live.projectArn, desiredTags);
            yield* session.note(projectName);
            return toAttributes(live);
        }),
        delete: Effect.fn(function* ({ output }) {
            yield* bda
                .deleteDataAutomationProject({ projectArn: output.projectArn })
                .pipe(Effect.catchTag("ResourceNotFoundException", () => Effect.void));
        }),
    });
}));
//# sourceMappingURL=DataAutomationProject.js.map