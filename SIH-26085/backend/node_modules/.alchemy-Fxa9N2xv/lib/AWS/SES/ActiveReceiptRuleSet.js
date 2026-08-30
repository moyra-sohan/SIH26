import * as ses from "@distilled.cloud/aws/ses";
import * as Effect from "effect/Effect";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
/**
 * The account's active Amazon SES receipt rule set — the single rule set (per
 * account, per region) that SES actually evaluates against inbound mail.
 *
 * This is an account-level singleton pointer, not a container: only one rule
 * set can be active at a time. Deleting this resource deactivates email
 * receiving (clears the pointer) only when the account is still pointed at the
 * rule set this resource set; if something else has since become active, the
 * delete is a no-op.
 * ### Activating a Rule Set
 * **Example:** Make a Rule Set Active
 * ```typescript
 * import * as SES from "alchemy/AWS/SES";
 *
 * const ruleSet = yield* SES.ReceiptRuleSet("Inbound", {});
 * const active = yield* SES.ActiveReceiptRuleSet("Active", {
 *   ruleSetName: ruleSet.ruleSetName,
 * });
 * ```
 *
 * @resource
 */
export const ActiveReceiptRuleSet = Resource("AWS.SES.ActiveReceiptRuleSet");
const activeRuleSetName = Effect.fn(function* () {
    const response = yield* ses.describeActiveReceiptRuleSet({});
    return response.Metadata?.Name;
});
export const ActiveReceiptRuleSetProvider = () => Provider.succeed(ActiveReceiptRuleSet, {
    // Account/region singleton setting: "deleting" it only clears the active
    // pointer, so nuke skips it (and would otherwise disable email receiving
    // account-wide).
    nuke: { singleton: true },
    list: () => Effect.succeed([]),
    read: Effect.fn(function* () {
        const name = yield* activeRuleSetName();
        return name ? { ruleSetName: name } : undefined;
    }),
    reconcile: Effect.fn(function* ({ news }) {
        // OBSERVE the current active pointer; only re-point on a mismatch.
        const observed = yield* activeRuleSetName();
        if (observed !== news.ruleSetName) {
            yield* ses.setActiveReceiptRuleSet({ RuleSetName: news.ruleSetName });
        }
        return { ruleSetName: news.ruleSetName };
    }),
    delete: Effect.fn(function* ({ output }) {
        // Only deactivate if the account is still pointed at the rule set we
        // activated; otherwise another owner has taken over and we leave it be.
        const observed = yield* activeRuleSetName();
        if (observed === output.ruleSetName) {
            yield* ses.setActiveReceiptRuleSet({});
        }
    }),
});
//# sourceMappingURL=ActiveReceiptRuleSet.js.map