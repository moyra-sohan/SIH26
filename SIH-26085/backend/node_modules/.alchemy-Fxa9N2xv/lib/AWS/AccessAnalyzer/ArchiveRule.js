import * as aa from "@distilled.cloud/aws/accessanalyzer";
import * as Effect from "effect/Effect";
import { isResolved } from "../../Diff.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
/**
 * An archive rule for an IAM Access Analyzer — automatically archives new
 * findings that match the filter criteria, so expected cross-account or
 * public grants don't clutter the active findings list.
 *
 * Archive rules apply only to findings created after the rule; existing
 * findings are unaffected.
 * ### Creating Archive Rules
 * **Example:** Archive Findings from a Trusted Account
 * ```typescript
 * import * as AWS from "alchemy/AWS";
 *
 * const analyzer = yield* AWS.AccessAnalyzer.Analyzer("AccountAnalyzer", {});
 *
 * yield* AWS.AccessAnalyzer.ArchiveRule("TrustedAccount", {
 *   analyzerName: analyzer.analyzerName,
 *   ruleName: "trusted-account",
 *   filter: {
 *     "principal.AWS": { eq: ["123456789012"] },
 *   },
 * });
 * ```
 *
 * **Example:** Archive Public S3 Findings
 * ```typescript
 * yield* AWS.AccessAnalyzer.ArchiveRule("PublicBuckets", {
 *   analyzerName: analyzer.analyzerName,
 *   ruleName: "public-buckets",
 *   filter: {
 *     resourceType: { eq: ["AWS::S3::Bucket"] },
 *     isPublic: { eq: ["true"] },
 *   },
 * });
 * ```
 *
 * @resource
 */
export const ArchiveRule = Resource("AWS.AccessAnalyzer.ArchiveRule");
export const ArchiveRuleProvider = () => Provider.effect(ArchiveRule, Effect.gen(function* () {
    const toFilter = (filter) => Object.fromEntries(Object.entries(filter).map(([key, criterion]) => [
        key,
        {
            eq: criterion.eq,
            neq: criterion.neq,
            contains: criterion.contains,
            exists: criterion.exists,
        },
    ]));
    const observe = Effect.fn(function* (analyzerName, ruleName) {
        return yield* aa.getArchiveRule({ analyzerName, ruleName }).pipe(Effect.map((r) => r.archiveRule), Effect.catchTag("ResourceNotFoundException", () => Effect.succeed(undefined)));
    });
    return ArchiveRule.Provider.of({
        stables: ["analyzerName", "ruleName"],
        // sub-resource keyed by parent analyzer + rule name — not enumerable
        // account-wide without the parent
        list: () => Effect.succeed([]),
        read: Effect.fn(function* ({ olds, output }) {
            const analyzerName = output?.analyzerName ?? olds?.analyzerName;
            const ruleName = output?.ruleName ?? olds?.ruleName;
            if (analyzerName === undefined || ruleName === undefined) {
                return undefined;
            }
            const rule = yield* observe(analyzerName, ruleName);
            if (rule === undefined)
                return undefined;
            return { analyzerName, ruleName: rule.ruleName };
        }),
        diff: Effect.fn(function* ({ news, olds }) {
            if (!isResolved(news))
                return undefined;
            if (olds.analyzerName !== news.analyzerName) {
                return { action: "replace" };
            }
            if (olds.ruleName !== news.ruleName) {
                return { action: "replace" };
            }
            // filter is mutable → default update path
        }),
        reconcile: Effect.fn(function* ({ news, output, session }) {
            const filter = toFilter(news.filter);
            // 1. OBSERVE — cloud state is authoritative
            const existing = yield* observe(news.analyzerName, news.ruleName);
            // 2. ENSURE / SYNC — createArchiveRule for a new rule, otherwise
            //    updateArchiveRule to converge the filter. Both are idempotent.
            if (existing === undefined) {
                yield* aa
                    .createArchiveRule({
                    analyzerName: news.analyzerName,
                    ruleName: news.ruleName,
                    filter,
                })
                    .pipe(
                // a concurrent create — fall through to update the filter
                Effect.catchTag("ConflictException", () => aa.updateArchiveRule({
                    analyzerName: news.analyzerName,
                    ruleName: news.ruleName,
                    filter,
                })));
            }
            else {
                yield* aa.updateArchiveRule({
                    analyzerName: news.analyzerName,
                    ruleName: news.ruleName,
                    filter,
                });
            }
            yield* session.note(news.ruleName);
            return {
                analyzerName: news.analyzerName,
                ruleName: news.ruleName,
            };
        }),
        delete: Effect.fn(function* ({ output }) {
            yield* aa
                .deleteArchiveRule({
                analyzerName: output.analyzerName,
                ruleName: output.ruleName,
            })
                .pipe(Effect.catchTag("ResourceNotFoundException", () => Effect.void));
        }),
    });
}));
//# sourceMappingURL=ArchiveRule.js.map