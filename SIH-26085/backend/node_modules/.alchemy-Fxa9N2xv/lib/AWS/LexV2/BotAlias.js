import * as lexm from "@distilled.cloud/aws/lex-models-v2";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";
import { Unowned } from "../../AdoptPolicy.js";
import { isResolved } from "../../Diff.js";
import { createPhysicalName } from "../../PhysicalName.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
import { createInternalTags, hasAlchemyTags } from "../../Tags.js";
import { AWSEnvironment } from "../Environment.js";
import { readLexTags, toLexName, retryWhileConflict, syncLexTags, waitForAliasSettled, } from "./internal.js";
/**
 * Two different Lambda functions were registered as the code hook of the
 * same alias locale — Lex supports exactly one dialog/fulfillment function
 * per alias locale.
 */
export class ConflictingCodeHook extends Data.TaggedError("ConflictingCodeHook") {
}
/**
 * An alias of an Amazon Lex V2 bot — a stable pointer to a numbered bot
 * version that runtime conversations (e.g. `RecognizeText`) target.
 *
 * ### Creating an Alias
 * **Example:** Alias on a Version
 * ```typescript
 * import * as AWS from "alchemy/AWS";
 *
 * const alias = yield* AWS.LexV2.BotAlias("Live", {
 *   botId: version.botId,
 *   botVersion: version.botVersion,
 * });
 * ```
 *
 * **Example:** Unassociated Alias
 * ```typescript
 * // point it at a version later without changing consumers
 * const alias = yield* AWS.LexV2.BotAlias("Staging", {
 *   botId: bot.botId,
 * });
 * ```
 *
 * ### Conversing at Runtime
 * **Example:** RecognizeText from a Lambda
 * ```typescript
 * const recognizeText = yield* AWS.LexV2.RecognizeText(alias);
 * const reply = yield* recognizeText({
 *   localeId: "en_US",
 *   sessionId: "user-123",
 *   text: "hello",
 * });
 * ```
 *
 * @resource
 */
export const BotAlias = Resource("AWS.LexV2.BotAlias");
const createAliasName = (id, props) => Effect.gen(function* () {
    if (props.botAliasName)
        return props.botAliasName;
    return toLexName(yield* createPhysicalName({ id, maxLength: 100 }));
});
const describeAlias = Effect.fn(function* (botId, botAliasId) {
    return yield* lexm
        .describeBotAlias({ botId, botAliasId })
        .pipe(Effect.catchTag("ResourceNotFoundException", () => Effect.succeed(undefined)));
});
/** Find an alias of the bot by exact name (used when state was lost). */
const findAliasByName = Effect.fn(function* (botId, botAliasName) {
    const pages = yield* lexm.listBotAliases.pages({ botId }).pipe(Stream.runCollect, Effect.catchTag("ResourceNotFoundException", () => Effect.succeed([])));
    const summary = Array.from(pages)
        .flatMap((page) => page.botAliasSummaries ?? [])
        .find((alias) => alias.botAliasName === botAliasName);
    if (summary?.botAliasId === undefined)
        return undefined;
    return yield* describeAlias(botId, summary.botAliasId);
});
const aliasArnOf = Effect.fn(function* (botId, botAliasId) {
    const { accountId, region } = yield* AWSEnvironment.current;
    return `arn:aws:lex:${region}:${accountId}:bot-alias/${botId}/${botAliasId}`;
});
/**
 * The alias's desired code hooks: `props.codeHooks` merged with the entries
 * contributed through the binding contract (`LexV2.onCodeHook`). Fails when
 * two different function ARNs target the same locale. Returns `undefined`
 * when no code hooks are desired (omitting `botAliasLocaleSettings` clears
 * them on both create and update).
 */
const resolveCodeHooks = Effect.fn(function* (news, bindings) {
    const merged = {};
    const contributions = [
        news.codeHooks,
        ...bindings.map((binding) => binding.data?.codeHooks ??
            binding.codeHooks),
    ];
    for (const hooks of contributions) {
        if (hooks === undefined)
            continue;
        for (const [localeId, arn] of Object.entries(hooks)) {
            const existing = merged[localeId];
            if (existing !== undefined && existing !== arn) {
                return yield* Effect.fail(new ConflictingCodeHook({
                    localeId,
                    functionArns: [existing, arn],
                }));
            }
            merged[localeId] = arn;
        }
    }
    return Object.keys(merged).length > 0 ? merged : undefined;
});
/** Build the wire `botAliasLocaleSettings` map from desired code hooks. */
const toLocaleSettings = (codeHooks) => codeHooks === undefined
    ? undefined
    : Object.fromEntries(Object.entries(codeHooks).map(([localeId, lambdaARN]) => [
        localeId,
        {
            enabled: true,
            codeHookSpecification: {
                lambdaCodeHook: { lambdaARN, codeHookInterfaceVersion: "1.0" },
            },
        },
    ]));
/**
 * Project the aspects of `botAliasLocaleSettings` this resource manages
 * (enabled + lambda ARN per locale) into a canonical string for drift
 * comparison.
 */
const localeSettingsProjection = (settings) => JSON.stringify(Object.entries(settings ?? {})
    .filter(([, value]) => value !== undefined)
    .map(([localeId, value]) => [
    localeId,
    value.enabled,
    value.codeHookSpecification?.lambdaCodeHook.lambdaARN,
])
    .sort((a, b) => String(a[0]).localeCompare(String(b[0]))));
const attributesOf = Effect.fn(function* (alias) {
    const botAliasArn = yield* aliasArnOf(alias.botId, alias.botAliasId);
    return {
        botAliasId: alias.botAliasId,
        botAliasName: alias.botAliasName,
        botAliasArn,
        botId: alias.botId,
        botVersion: alias.botVersion,
        botAliasStatus: alias.botAliasStatus,
        tags: yield* readLexTags(botAliasArn),
    };
});
export const BotAliasProvider = () => Provider.effect(BotAlias, Effect.gen(function* () {
    return {
        stables: ["botAliasId", "botAliasArn", "botId"],
        // Sub-resource keyed entirely by its bot — nuke reaches it through
        // the parent bot's deletion.
        list: () => Effect.succeed([]),
        read: Effect.fn(function* ({ id, olds, output }) {
            const botId = output?.botId ?? olds?.botId;
            if (botId === undefined)
                return undefined;
            const observed = output?.botAliasId !== undefined
                ? yield* describeAlias(botId, output.botAliasId)
                : yield* findAliasByName(botId, yield* createAliasName(id, olds ?? {}));
            if (observed === undefined)
                return undefined;
            const attrs = yield* attributesOf(observed);
            return (yield* hasAlchemyTags(id, attrs.tags))
                ? attrs
                : Unowned(attrs);
        }),
        diff: Effect.fn(function* ({ news, olds }) {
            if (!isResolved(news))
                return undefined;
            if (olds?.botId !== news.botId) {
                return { action: "replace" };
            }
        }),
        reconcile: Effect.fn(function* ({ id, news, output, session, bindings, }) {
            const botAliasName = yield* createAliasName(id, news);
            const internalTags = yield* createInternalTags(id);
            const desiredTags = { ...internalTags, ...news.tags };
            const desiredCodeHooks = yield* resolveCodeHooks(news, bindings);
            const desiredLocaleSettings = toLocaleSettings(desiredCodeHooks);
            // 1. OBSERVE — output.botAliasId is only a cache; fall back to name.
            let observed = output?.botAliasId !== undefined
                ? yield* describeAlias(news.botId, output.botAliasId)
                : undefined;
            if (observed === undefined) {
                observed = yield* findAliasByName(news.botId, botAliasName);
            }
            // 2. ENSURE — create when missing.
            if (observed === undefined) {
                const created = yield* retryWhileConflict(lexm.createBotAlias({
                    botId: news.botId,
                    botAliasName,
                    botVersion: news.botVersion,
                    botAliasLocaleSettings: desiredLocaleSettings,
                    description: news.description,
                    tags: desiredTags,
                }));
                observed = yield* waitForAliasSettled(news.botId, created.botAliasId);
            }
            else if (
            // 3. SYNC — apply the delta when a declared prop drifted.
            observed.botAliasName !== botAliasName ||
                (observed.botVersion ?? undefined) !==
                    (news.botVersion ?? undefined) ||
                (observed.description ?? undefined) !==
                    (news.description ?? undefined) ||
                localeSettingsProjection(observed.botAliasLocaleSettings) !==
                    localeSettingsProjection(desiredLocaleSettings)) {
                yield* retryWhileConflict(lexm.updateBotAlias({
                    botId: news.botId,
                    botAliasId: observed.botAliasId,
                    botAliasName,
                    botVersion: news.botVersion,
                    botAliasLocaleSettings: desiredLocaleSettings,
                    description: news.description,
                }));
                observed = yield* waitForAliasSettled(news.botId, observed.botAliasId);
            }
            // 3b. SYNC TAGS — diff against observed cloud tags.
            const botAliasArn = yield* aliasArnOf(news.botId, observed.botAliasId);
            const observedTags = yield* readLexTags(botAliasArn);
            yield* syncLexTags(botAliasArn, observedTags, desiredTags);
            yield* session.note(observed.botAliasId);
            return yield* attributesOf(observed);
        }),
        delete: Effect.fn(function* ({ output }) {
            // Lex reports a missing alias (or already-deleted parent bot) as
            // PreconditionFailed.
            yield* retryWhileConflict(lexm.deleteBotAlias({
                botId: output.botId,
                botAliasId: output.botAliasId,
                skipResourceInUseCheck: true,
            })).pipe(Effect.catchTag("PreconditionFailedException", () => Effect.void));
        }),
    };
}));
//# sourceMappingURL=BotAlias.js.map