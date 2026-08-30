import * as quicksight from "@distilled.cloud/aws/quicksight";
import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";
import { Unowned } from "../../AdoptPolicy.js";
import { isResolved } from "../../Diff.js";
import { createPhysicalName } from "../../PhysicalName.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
import { createInternalTags, hasAlchemyTags } from "../../Tags.js";
import { AWSEnvironment } from "../Environment.js";
import { readQuickSightTags, syncQuickSightTags, toWireTags, waitForSettled, } from "./internal.js";
/**
 * An Amazon QuickSight analysis — an editable workspace built from a template
 * or an inline definition, which can be published as a dashboard.
 *
 * QuickSight requires an active account subscription in the region. Without
 * one, create operations fail with the typed `QuickSightSubscriptionRequired`
 * error.
 *
 * ### Creating an Analysis
 * **Example:** Analysis from a Template
 * ```typescript
 * const analysis = yield* Analysis("explore-sales", {
 *   name: "Explore Sales",
 *   sourceEntity: {
 *     SourceTemplate: {
 *       Arn: templateArn,
 *       DataSetReferences: [
 *         { DataSetPlaceholder: "sales", DataSetArn: dataset.arn },
 *       ],
 *     },
 *   },
 * });
 * ```
 *
 * @resource
 */
export const Analysis = Resource("AWS.QuickSight.Analysis");
export const AnalysisProvider = () => Provider.effect(Analysis, Effect.gen(function* () {
    const toId = (id, props) => props.analysisId
        ? Effect.succeed(props.analysisId)
        : createPhysicalName({ id, maxLength: 64 });
    const readAnalysis = Effect.fn(function* (accountId, analysisId) {
        const response = yield* quicksight
            .describeAnalysis({ AwsAccountId: accountId, AnalysisId: analysisId })
            .pipe(Effect.catchTag("ResourceNotFoundException", () => Effect.succeed(undefined)));
        const analysis = response?.Analysis;
        if (analysis === undefined || analysis.Status === "DELETED") {
            return undefined;
        }
        return analysis;
    });
    const settle = (accountId, analysisId) => waitForSettled(analysisId, readAnalysis(accountId, analysisId).pipe(Effect.map((a) => a === undefined ? undefined : { ...a, status: a.Status })));
    const toAttrs = (analysis) => ({
        analysisId: analysis.AnalysisId,
        arn: analysis.Arn,
        name: analysis.Name ?? "",
        status: analysis.Status ?? "",
    });
    return Analysis.Provider.of({
        stables: ["analysisId", "arn"],
        diff: Effect.fn(function* ({ id, olds = {}, news }) {
            if (!isResolved(news))
                return undefined;
            if ((yield* toId(id, olds)) !== (yield* toId(id, news))) {
                return { action: "replace" };
            }
        }),
        read: Effect.fn(function* ({ id, olds = {}, output }) {
            const { accountId } = yield* AWSEnvironment.current;
            const analysisId = output?.analysisId ?? (yield* toId(id, olds));
            const analysis = yield* readAnalysis(accountId, analysisId);
            if (analysis === undefined)
                return undefined;
            const attrs = toAttrs(analysis);
            const tags = yield* readQuickSightTags(attrs.arn);
            return (yield* hasAlchemyTags(id, tags)) ? attrs : Unowned(attrs);
        }),
        reconcile: Effect.fn(function* ({ id, news, output, session }) {
            const { accountId } = yield* AWSEnvironment.current;
            const analysisId = output?.analysisId ?? (yield* toId(id, news));
            const internalTags = yield* createInternalTags(id);
            const desiredTags = { ...internalTags, ...news.tags };
            // 1. Observe.
            let observed = yield* readAnalysis(accountId, analysisId);
            // 2. Ensure — create if missing.
            if (observed === undefined) {
                yield* quicksight
                    .createAnalysis({
                    AwsAccountId: accountId,
                    AnalysisId: analysisId,
                    Name: news.name,
                    SourceEntity: news.sourceEntity,
                    Definition: news.definition,
                    Parameters: news.parameters,
                    Permissions: news.permissions,
                    ThemeArn: news.themeArn,
                    Tags: toWireTags(desiredTags),
                })
                    .pipe(Effect.catchTag("ResourceExistsException", () => Effect.void));
            }
            else {
                // 3. Sync.
                yield* quicksight.updateAnalysis({
                    AwsAccountId: accountId,
                    AnalysisId: analysisId,
                    Name: news.name,
                    SourceEntity: news.sourceEntity,
                    Definition: news.definition,
                    Parameters: news.parameters,
                    ThemeArn: news.themeArn,
                });
            }
            observed = yield* settle(accountId, analysisId);
            if (observed === undefined) {
                return yield* Effect.fail(new Error(`QuickSight analysis '${analysisId}' not found after reconcile`));
            }
            // 3b. Sync tags.
            yield* syncQuickSightTags(observed.Arn, desiredTags);
            yield* session.note(analysisId);
            return toAttrs(observed);
        }),
        delete: Effect.fn(function* ({ olds, output }) {
            const { accountId } = yield* AWSEnvironment.current;
            yield* quicksight
                .deleteAnalysis({
                AwsAccountId: accountId,
                AnalysisId: output.analysisId,
                ForceDeleteWithoutRecovery: olds?.forceDeleteWithoutRecovery ?? true,
            })
                .pipe(Effect.catchTag("ResourceNotFoundException", () => Effect.void));
        }),
        list: () => Effect.gen(function* () {
            const { accountId } = yield* AWSEnvironment.current;
            return yield* quicksight.listAnalyses
                .pages({ AwsAccountId: accountId })
                .pipe(Stream.runCollect, Effect.map((chunk) => Array.from(chunk)
                .flatMap((page) => page.AnalysisSummaryList ?? [])
                .flatMap((s) => s.AnalysisId !== undefined &&
                s.Arn !== undefined &&
                s.Status !== "DELETED"
                ? [
                    {
                        analysisId: s.AnalysisId,
                        arn: s.Arn,
                        name: s.Name ?? "",
                        status: s.Status ?? "",
                    },
                ]
                : [])));
        }),
    });
}));
//# sourceMappingURL=Analysis.js.map