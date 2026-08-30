import * as securityhub from "@distilled.cloud/aws/securityhub";
import * as Effect from "effect/Effect";
import { Unowned } from "../../AdoptPolicy.js";
import { createPhysicalName } from "../../PhysicalName.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
import { createInternalTags, diffTags, hasAlchemyTags, tagRecord, } from "../../Tags.js";
/**
 * A Security Hub automation rule — automatically updates findings that match
 * its criteria (suppress, change severity, add notes) as they are ingested.
 *
 * ### Automating Finding Triage
 * **Example:** Suppress Informational Findings
 * ```typescript
 * const rule = yield* AWS.SecurityHub.AutomationRule("SuppressInfo", {
 *   description: "Suppress informational findings",
 *   ruleOrder: 1,
 *   criteria: {
 *     SeverityLabel: [{ Value: "INFORMATIONAL", Comparison: "EQUALS" }],
 *   },
 *   actions: [{
 *     Type: "FINDING_FIELDS_UPDATE",
 *     FindingFieldsUpdate: { Workflow: { Status: "SUPPRESSED" } },
 *   }],
 * });
 * ```
 *
 * **Example:** Escalate Production Findings
 * ```typescript
 * const rule = yield* AWS.SecurityHub.AutomationRule("EscalateProd", {
 *   description: "Raise severity of findings on production resources",
 *   ruleOrder: 2,
 *   isTerminal: true,
 *   criteria: {
 *     ResourceTags: [{ Key: "env", Value: "prod", Comparison: "EQUALS" }],
 *   },
 *   actions: [{
 *     Type: "FINDING_FIELDS_UPDATE",
 *     FindingFieldsUpdate: { Severity: { Label: "CRITICAL" } },
 *   }],
 * });
 * ```
 */
const AutomationRuleResource = Resource("AWS.SecurityHub.AutomationRule");
export { AutomationRuleResource as AutomationRule };
export const AutomationRuleProvider = () => Provider.effect(AutomationRuleResource, Effect.gen(function* () {
    const toName = (id, props) => props.ruleName
        ? Effect.succeed(props.ruleName)
        : createPhysicalName({ id, maxLength: 128 });
    const getRule = (arn) => securityhub
        .batchGetAutomationRules({ AutomationRulesArns: [arn] })
        .pipe(Effect.map((r) => r.Rules?.[0]), Effect.catchTag("ResourceNotFoundException", () => Effect.succeed(undefined)), Effect.catchTag("InvalidAccessException", () => Effect.succeed(undefined)));
    // `ListAutomationRules` is not modeled as paginated in the Smithy spec
    // (no `.pages` helper) — page manually, bounded (accounts are limited
    // to 100 rules).
    const listRules = Effect.gen(function* () {
        const out = [];
        let nextToken;
        for (let i = 0; i < 10; i++) {
            const page = yield* securityhub.listAutomationRules({
                MaxResults: 100,
                NextToken: nextToken,
            });
            out.push(...(page.AutomationRulesMetadata ?? []));
            nextToken = page.NextToken;
            if (!nextToken)
                break;
        }
        return out;
    }).pipe(Effect.catchTag("InvalidAccessException", () => Effect.succeed([])));
    const readTags = (arn) => securityhub.listTagsForResource({ ResourceArn: arn }).pipe(Effect.map((r) => tagRecord(r.Tags)), Effect.catch(() => Effect.succeed({})));
    const buildAttrs = (r) => ({
        ruleArn: r.RuleArn,
        ruleName: r.RuleName ?? "",
        ruleOrder: r.RuleOrder,
        ruleStatus: r.RuleStatus,
        isTerminal: r.IsTerminal,
    });
    return {
        stables: ["ruleArn"],
        read: Effect.fn(function* ({ id, olds, output }) {
            let arn = output?.ruleArn;
            if (!arn) {
                // No prior state — find by (deterministic) name.
                const name = yield* toName(id, olds ?? {});
                const all = yield* listRules;
                arn = all.find((r) => r.RuleName === name)?.RuleArn;
            }
            if (!arn)
                return undefined;
            const live = yield* getRule(arn);
            if (!live)
                return undefined;
            const attrs = buildAttrs(live);
            const tags = yield* readTags(arn);
            return (yield* hasAlchemyTags(id, tags)) ? attrs : Unowned(attrs);
        }),
        list: () => listRules.pipe(Effect.map((all) => all.filter((r) => r.RuleArn).map((r) => buildAttrs(r)))),
        reconcile: Effect.fn(function* ({ id, news, output, session }) {
            const name = yield* toName(id, news);
            const internalTags = yield* createInternalTags(id);
            const desiredTags = { ...news.tags, ...internalTags };
            // 1. OBSERVE — by cached ARN first, then by name.
            let arn = output?.ruleArn;
            let live = arn ? yield* getRule(arn) : undefined;
            if (!live) {
                const all = yield* listRules;
                arn = all.find((r) => r.RuleName === name)?.RuleArn;
                live = arn ? yield* getRule(arn) : undefined;
            }
            if (!live) {
                // 2. ENSURE — create with tags applied inline.
                const { RuleArn } = yield* securityhub.createAutomationRule({
                    RuleName: name,
                    Description: news.description,
                    RuleOrder: news.ruleOrder,
                    RuleStatus: news.ruleStatus ?? "ENABLED",
                    IsTerminal: news.isTerminal ?? false,
                    Criteria: news.criteria,
                    Actions: news.actions,
                    Tags: desiredTags,
                });
                arn = RuleArn;
            }
            else {
                arn = live.RuleArn;
                // 3. SYNC settings — observed ↔ desired.
                const desiredStatus = news.ruleStatus ?? "ENABLED";
                const desiredTerminal = news.isTerminal ?? false;
                const drift = live.RuleName !== name ||
                    live.Description !== news.description ||
                    live.RuleOrder !== news.ruleOrder ||
                    live.RuleStatus !== desiredStatus ||
                    (live.IsTerminal ?? false) !== desiredTerminal ||
                    JSON.stringify(live.Criteria) !== JSON.stringify(news.criteria) ||
                    JSON.stringify(live.Actions) !== JSON.stringify(news.actions);
                if (drift) {
                    yield* securityhub.batchUpdateAutomationRules({
                        UpdateAutomationRulesRequestItems: [
                            {
                                RuleArn: arn,
                                RuleName: name,
                                Description: news.description,
                                RuleOrder: news.ruleOrder,
                                RuleStatus: desiredStatus,
                                IsTerminal: desiredTerminal,
                                Criteria: news.criteria,
                                Actions: news.actions,
                            },
                        ],
                    });
                }
                // 3b. SYNC tags — diff against OBSERVED cloud tags.
                const currentTags = yield* readTags(arn);
                const { upsert, removed } = diffTags(currentTags, desiredTags);
                if (upsert.length > 0) {
                    yield* securityhub.tagResource({
                        ResourceArn: arn,
                        Tags: Object.fromEntries(upsert.map((t) => [t.Key, t.Value])),
                    });
                }
                if (removed.length > 0) {
                    yield* securityhub.untagResource({
                        ResourceArn: arn,
                        TagKeys: removed,
                    });
                }
            }
            // 4. RETURN fresh attributes.
            const final = yield* getRule(arn);
            yield* session.note(arn);
            return buildAttrs(final ?? { RuleArn: arn, RuleName: name });
        }),
        delete: Effect.fn(function* ({ output }) {
            // Idempotent — an unknown ARN comes back in
            // UnprocessedAutomationRules rather than as an error.
            yield* securityhub
                .batchDeleteAutomationRules({
                AutomationRulesArns: [output.ruleArn],
            })
                .pipe(Effect.catchTag("ResourceNotFoundException", () => Effect.void), Effect.catchTag("InvalidAccessException", () => Effect.void));
        }),
    };
}));
//# sourceMappingURL=AutomationRule.js.map