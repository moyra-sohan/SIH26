import * as auditmanager from "@distilled.cloud/aws/auditmanager";
import * as Effect from "effect/Effect";
import * as EffectStream from "effect/Stream";
import { Unowned } from "../../AdoptPolicy.js";
import { createPhysicalName } from "../../PhysicalName.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
import { createInternalTags, diffTags, hasAlchemyTags, } from "../../Tags.js";
import { toTagRecord, unredact } from "./internal.js";
/**
 * A custom control in AWS Audit Manager — a compliance requirement paired
 * with the data sources (CloudTrail, Config, Security Hub, API calls, or
 * manual evidence) Audit Manager collects evidence from to demonstrate it.
 *
 * :::note
 * Audit Manager must be registered in the account (`RegisterAccount`)
 * before controls can be created.
 * :::
 * ### Creating Controls
 * **Example:** Manual-Evidence Control
 * ```typescript
 * import * as AWS from "alchemy/AWS";
 *
 * const control = yield* AWS.AuditManager.Control("AccessReview", {
 *   description: "Quarterly review of privileged access",
 *   controlMappingSources: [{
 *     sourceName: "access-review-records",
 *     sourceSetUpOption: "Procedural_Controls_Mapping",
 *     sourceType: "MANUAL",
 *   }],
 * });
 * ```
 *
 * **Example:** CloudTrail-Backed Control
 * ```typescript
 * const control = yield* AWS.AuditManager.Control("RootLoginMonitor", {
 *   description: "Detects console logins by the root user",
 *   controlMappingSources: [{
 *     sourceName: "root-console-logins",
 *     sourceSetUpOption: "System_Controls_Mapping",
 *     sourceType: "AWS_Cloudtrail",
 *     sourceKeyword: {
 *       keywordInputType: "SELECT_FROM_LIST",
 *       keywordValue: "ConsoleLogin",
 *     },
 *     sourceFrequency: "DAILY",
 *   }],
 * });
 * ```
 *
 * @resource
 */
export const Control = Resource("AWS.AuditManager.Control");
const createControlName = (id, props) => props.name
    ? Effect.succeed(props.name)
    : createPhysicalName({ id, maxLength: 100 });
const toAttributes = (control) => ({
    controlId: control.id ?? "",
    arn: control.arn ?? "",
    name: control.name ?? "",
    type: control.type,
    state: control.state,
    tags: toTagRecord(control.tags),
});
const readControlById = Effect.fn(function* (controlId) {
    const response = yield* auditmanager
        .getControl({ controlId })
        .pipe(Effect.catchTag("ResourceNotFoundException", () => Effect.succeed(undefined)));
    return response?.control;
});
const findControlByName = Effect.fn(function* (name) {
    const pages = yield* auditmanager.listControls
        .pages({ controlType: "Custom" })
        .pipe(EffectStream.runCollect);
    const match = Array.from(pages)
        .flatMap((page) => page.controlMetadataList ?? [])
        .find((control) => control.name === name);
    if (!match?.id)
        return undefined;
    return yield* readControlById(match.id);
});
/**
 * Projection used for drift detection between desired and observed mapping
 * sources — server-assigned fields (sourceId) are excluded.
 */
const projectSource = (source) => ({
    sourceName: source.sourceName ?? "",
    sourceDescription: source.sourceDescription ?? "",
    sourceSetUpOption: source.sourceSetUpOption ?? "",
    sourceType: source.sourceType ?? "",
    keywordInputType: source.sourceKeyword?.keywordInputType ?? "",
    keywordValue: source.sourceKeyword?.keywordValue ?? "",
    sourceFrequency: source.sourceFrequency ?? "",
    troubleshootingText: source.troubleshootingText ?? "",
});
export const ControlProvider = () => Provider.effect(Control, Effect.gen(function* () {
    return {
        stables: ["controlId", "arn"],
        list: () => Effect.gen(function* () {
            const pages = yield* auditmanager.listControls
                .pages({ controlType: "Custom" })
                .pipe(EffectStream.runCollect);
            const ids = Array.from(pages)
                .flatMap((page) => page.controlMetadataList ?? [])
                .flatMap((control) => (control.id ? [control.id] : []));
            const hydrated = yield* Effect.forEach(ids, (controlId) => readControlById(controlId), { concurrency: 5 });
            return hydrated.flatMap((control) => control === undefined ? [] : [toAttributes(control)]);
        }),
        read: Effect.fn(function* ({ id, olds, output }) {
            const control = output?.controlId
                ? yield* readControlById(output.controlId)
                : yield* findControlByName(yield* createControlName(id, olds ?? {}));
            if (!control)
                return undefined;
            const attrs = toAttributes(control);
            return (yield* hasAlchemyTags(id, attrs.tags))
                ? attrs
                : Unowned(attrs);
        }),
        reconcile: Effect.fn(function* ({ id, news, output, session }) {
            const name = yield* createControlName(id, news);
            const internalTags = yield* createInternalTags(id);
            const desiredTags = { ...internalTags, ...news.tags };
            // Observe — prefer the cached id; fall back to a name lookup so a
            // create whose state failed to persist is adopted, not duplicated.
            let control = output?.controlId
                ? yield* readControlById(output.controlId)
                : yield* findControlByName(name);
            // Ensure — create if missing.
            if (control === undefined) {
                const created = yield* auditmanager.createControl({
                    name,
                    description: news.description,
                    testingInformation: news.testingInformation,
                    actionPlanTitle: news.actionPlanTitle,
                    actionPlanInstructions: news.actionPlanInstructions,
                    controlMappingSources: news.controlMappingSources,
                    tags: desiredTags,
                });
                control = created.control;
                if (!control?.id) {
                    return yield* Effect.fail(new Error(`CreateControl for '${name}' returned no control`));
                }
                yield* session.note(`Created control ${name} (${control.id})`);
            }
            // Sync — diff observed against desired; UpdateControl on drift.
            const observedSources = (control.controlMappingSources ?? []).map((source) => projectSource({
                ...source,
                troubleshootingText: unredact(source.troubleshootingText),
            }));
            const desiredSources = news.controlMappingSources.map(projectSource);
            const drifted = (control.name ?? "") !== name ||
                (unredact(control.description) ?? "") !==
                    (news.description ?? "") ||
                (unredact(control.testingInformation) ?? "") !==
                    (news.testingInformation ?? "") ||
                (unredact(control.actionPlanTitle) ?? "") !==
                    (news.actionPlanTitle ?? "") ||
                (unredact(control.actionPlanInstructions) ?? "") !==
                    (news.actionPlanInstructions ?? "") ||
                JSON.stringify(observedSources) !== JSON.stringify(desiredSources);
            if (drifted) {
                // Reuse the server-assigned sourceId for sources whose name is
                // unchanged so AWS updates them in place instead of replacing.
                const observedByName = new Map((control.controlMappingSources ?? []).map((source) => [
                    source.sourceName,
                    source.sourceId,
                ]));
                const updated = yield* auditmanager.updateControl({
                    controlId: control.id ?? "",
                    name,
                    description: news.description,
                    testingInformation: news.testingInformation,
                    actionPlanTitle: news.actionPlanTitle,
                    actionPlanInstructions: news.actionPlanInstructions,
                    controlMappingSources: news.controlMappingSources.map((source) => ({
                        ...source,
                        sourceId: observedByName.get(source.sourceName),
                    })),
                });
                control = updated.control ?? control;
                yield* session.note(`Updated control ${name}`);
            }
            // Sync tags — diff against observed cloud tags.
            const attrs = toAttributes(control);
            const { removed, upsert } = diffTags(attrs.tags, desiredTags);
            if (removed.length > 0) {
                yield* auditmanager.untagResource({
                    resourceArn: attrs.arn,
                    tagKeys: removed,
                });
            }
            if (upsert.length > 0) {
                yield* auditmanager.tagResource({
                    resourceArn: attrs.arn,
                    tags: Object.fromEntries(upsert.map(({ Key, Value }) => [Key, Value])),
                });
            }
            yield* session.note(attrs.arn);
            return { ...attrs, tags: desiredTags };
        }),
        delete: Effect.fn(function* ({ output }) {
            yield* auditmanager
                .deleteControl({ controlId: output.controlId })
                .pipe(Effect.catchTag("ResourceNotFoundException", () => Effect.void));
        }),
    };
}));
//# sourceMappingURL=Control.js.map