import * as rulesets from "@distilled.cloud/cloudflare/rulesets";
import * as Effect from "effect/Effect";
import * as Predicate from "effect/Predicate";
import * as Stream from "effect/Stream";
import { Unowned } from "../../AdoptPolicy.js";
import { deepEqual, isResolved } from "../../Diff.js";
import { createPhysicalName } from "../../PhysicalName.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
import { CloudflareEnvironment } from "../CloudflareEnvironment.js";
const TypeId = "Cloudflare.Rulesets.CustomRuleset";
/**
 * A standalone account-level Cloudflare ruleset (`kind: "custom"`).
 *
 * Custom rulesets are the Enterprise WAF deployment workflow: define a
 * reusable ruleset once at the account level, then deploy it across zones
 * with an `execute` rule in a phase entrypoint (see
 * `Cloudflare.Ruleset.AccountEntrypoint`). Account-level WAF phases require
 * an Enterprise plan — on lower plans, creation fails with the typed
 * `PhaseNotEntitled` error.
 *
 * For zone-level rules, use `Cloudflare.Ruleset.Ruleset` (the zone phase
 * entrypoint) instead.
 * ### Custom Rulesets
 * **Example:** Define an account custom WAF ruleset
 * ```typescript
 * const ruleset = yield* Cloudflare.Ruleset.CustomRuleset("SharedWafRules", {
 *   phase: "http_request_firewall_custom",
 *   description: "Org-wide exploit probes",
 *   rules: [
 *     {
 *       description: "Block .env probes",
 *       expression: `lower(http.request.uri.path) contains "/.env"`,
 *       action: "block",
 *     },
 *   ],
 * });
 * ```
 *
 * **Example:** Deploy the custom ruleset via the account entrypoint
 * ```typescript
 * yield* Cloudflare.Ruleset.AccountEntrypoint("WafDeployment", {
 *   phase: "http_request_firewall_custom",
 *   rules: [
 *     {
 *       description: "Deploy shared WAF rules everywhere",
 *       expression: "true",
 *       action: "execute",
 *       actionParameters: { id: ruleset.rulesetId },
 *     },
 *   ],
 * });
 * ```
 *
 * @see https://developers.cloudflare.com/waf/account/custom-rulesets/
 *
 * @resource
 * @product Rulesets
 * @category Rules & Configuration
 */
export const CustomRuleset = Resource(TypeId);
/**
 * Returns true if the given value is a CustomRuleset resource.
 */
export const isCustomRuleset = (value) => Predicate.hasProperty(value, "Type") && value.Type === TypeId;
export const CustomRulesetProvider = () => Provider.succeed(CustomRuleset, {
    stables: ["rulesetId", "accountId", "kind", "phase"],
    diff: Effect.fn(function* ({ id, olds, news, output }) {
        if (!isResolved(news))
            return undefined;
        // kind and phase are immutable on Cloudflare's API.
        if ((olds.kind ?? "custom") !== (news.kind ?? "custom")) {
            return { action: "replace" };
        }
        if (olds.phase !== news.phase) {
            return { action: "replace" };
        }
        const { accountId } = yield* yield* CloudflareEnvironment;
        if (output !== undefined && output.accountId !== accountId) {
            return { action: "replace" };
        }
        const oldName = output?.name ?? olds.name ?? (yield* createPhysicalName({ id }));
        // Auto-generated names are engine-owned: the deployed name stays
        // authoritative even if the generator would name this id differently
        // today. Only an explicit user-provided name can force a rename.
        const name = news.name ?? oldName;
        if (oldName !== name ||
            olds.description !== news.description ||
            !deepEqual(olds.rules, news.rules)) {
            return { action: "update" };
        }
    }),
    read: Effect.fn(function* ({ id, olds, output }) {
        const { accountId } = yield* yield* CloudflareEnvironment;
        if (output !== undefined) {
            return yield* rulesets
                .getRulesetForAccount({
                accountId: output.accountId,
                rulesetId: output.rulesetId,
            })
                .pipe(Effect.map((ruleset) => toCustomRulesetAttributes(output.accountId, ruleset)), Effect.catchTag("RulesetNotFound", () => Effect.succeed(undefined)));
        }
        // Cold lookup — no persisted state. Find the ruleset by its
        // deterministic name + phase + kind. Rulesets carry no tags, so we
        // cannot prove we created a match — report it `Unowned` and let the
        // engine gate takeover behind `--adopt`.
        const name = olds?.name ?? (yield* createPhysicalName({ id }));
        const kind = olds?.kind ?? "custom";
        const match = yield* rulesets.listRulesetsForAccount
            .items({ accountId })
            .pipe(Stream.runCollect, Effect.map((chunk) => Array.from(chunk).find((r) => r.name === name && r.phase === olds?.phase && r.kind === kind)));
        if (match === undefined)
            return undefined;
        const ruleset = yield* rulesets
            .getRulesetForAccount({ accountId, rulesetId: match.id })
            .pipe(Effect.catchTag("RulesetNotFound", () => Effect.succeed(undefined)));
        if (ruleset === undefined)
            return undefined;
        return Unowned(toCustomRulesetAttributes(accountId, ruleset));
    }),
    reconcile: Effect.fn(function* ({ id, news, output }) {
        const { accountId } = yield* yield* CloudflareEnvironment;
        // Prefer the deployed name: regenerating would target a different
        // resource if the generator's output for this id ever drifts.
        const name = news.name ?? output?.name ?? (yield* createPhysicalName({ id }));
        const kind = news.kind ?? "custom";
        // 1. Observe — the persisted rulesetId is a cache, not a guarantee.
        const observed = output !== undefined
            ? yield* rulesets
                .getRulesetForAccount({
                accountId,
                rulesetId: output.rulesetId,
            })
                .pipe(Effect.catchTag("RulesetNotFound", () => Effect.succeed(undefined)))
            : undefined;
        // 2. Ensure — create when missing.
        if (observed === undefined) {
            const created = yield* rulesets.createRulesetForAccount({
                accountId,
                kind,
                name,
                phase: news.phase,
                description: news.description,
                rules: news.rules,
            });
            return toCustomRulesetAttributes(accountId, created);
        }
        // 3. Sync — PUT the full desired state only when it differs from the
        //    observed cloud state.
        const observedAttributes = toCustomRulesetAttributes(accountId, observed);
        const desiredRules = normalizeDesiredRules(news.rules);
        if (observedAttributes.name === name &&
            observedAttributes.description === news.description &&
            deepEqual(normalizeObservedRules(observedAttributes.rules), desiredRules)) {
            return observedAttributes;
        }
        const updated = yield* rulesets.updateRulesetForAccount({
            accountId,
            rulesetId: observedAttributes.rulesetId,
            name,
            description: news.description,
            rules: news.rules,
        });
        return toCustomRulesetAttributes(accountId, updated);
    }),
    delete: Effect.fn(function* ({ output }) {
        // Idempotent — a ruleset already deleted out-of-band is not an error.
        yield* rulesets
            .deleteRulesetForAccount({
            accountId: output.accountId,
            rulesetId: output.rulesetId,
        })
            .pipe(Effect.catchTag("RulesetNotFound", () => Effect.void));
    }),
    // Account-scoped enumeration. `listRulesetsForAccount` returns every
    // ruleset kind (managed/root/custom/zone) but omits each ruleset's rules,
    // so filter to `custom` and hydrate each via `getRulesetForAccount` to
    // produce the full `read` Attributes shape. Per-item not-found / Forbidden
    // blips skip that ruleset rather than failing the whole enumeration.
    list: Effect.fn(function* () {
        const { accountId } = yield* yield* CloudflareEnvironment;
        const summaries = yield* rulesets.listRulesetsForAccount
            .pages({ accountId })
            .pipe(Stream.runCollect, Effect.map((chunk) => Array.from(chunk).flatMap((page) => (page.result ?? []).filter((r) => r.kind === "custom"))));
        const hydrated = yield* Effect.forEach(summaries, (summary) => rulesets
            .getRulesetForAccount({ accountId, rulesetId: summary.id })
            .pipe(Effect.map((ruleset) => toCustomRulesetAttributes(accountId, ruleset)), Effect.catchTag(["RulesetNotFound", "Forbidden"], () => Effect.succeed(undefined))), { concurrency: 10 });
        return hydrated.filter((row) => row !== undefined);
    }),
});
const toCustomRulesetAttributes = (accountId, ruleset) => ({
    rulesetId: ruleset.id,
    accountId,
    kind: ruleset.kind,
    name: ruleset.name,
    phase: ruleset.phase,
    description: ruleset.description ?? undefined,
    rules: (ruleset.rules ?? []).map(({ lastUpdated: _lastUpdated, version: _version, ...rule }) => rule),
    lastUpdated: ruleset.lastUpdated,
    version: ruleset.version,
});
/**
 * Strip server-assigned per-rule fields so observed rules can be compared
 * structurally against the desired props.
 */
const normalizeObservedRules = (rules) => rules.map(({ id: _id, ...rule }) => rule);
const normalizeDesiredRules = (rules) => rules.map(({ id: _id, ...rule }) => rule);
//# sourceMappingURL=CustomRuleset.js.map