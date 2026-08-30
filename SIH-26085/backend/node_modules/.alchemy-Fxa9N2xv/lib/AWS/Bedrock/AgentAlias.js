import * as bedrock from "@distilled.cloud/aws/bedrock-agent";
import * as Effect from "effect/Effect";
import * as Schedule from "effect/Schedule";
import * as Stream from "effect/Stream";
import { Unowned } from "../../AdoptPolicy.js";
import { isResolved } from "../../Diff.js";
import { createPhysicalName } from "../../PhysicalName.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
import { createInternalTags, diffTags, hasAlchemyTags } from "../../Tags.js";
/**
 * An alias for an Amazon Bedrock {@link Agent} — a stable, invocable pointer
 * to one or more agent versions.
 *
 * An alias is what applications invoke (via `bedrock-agent-runtime`
 * `InvokeAgent`). Creating an alias with no `routingConfiguration` snapshots
 * the agent's current DRAFT into a new immutable version and routes the alias
 * to it, so redeploying an updated + prepared agent and recreating the alias
 * publishes a new version.
 *
 * ### Creating Aliases
 * **Example:** Alias Pointing at the Current Agent
 * ```typescript
 * import * as Bedrock from "alchemy/AWS/Bedrock";
 *
 * const agent = yield* Bedrock.Agent("assistant", {
 *   foundationModel: "us.anthropic.claude-3-5-sonnet-20240620-v1:0",
 *   instruction: "You are a helpful assistant.",
 * });
 *
 * const alias = yield* Bedrock.AgentAlias("prod", {
 *   agentId: agent.agentId,
 * });
 * ```
 *
 * **Example:** Alias Pinned to a Specific Version
 * ```typescript
 * const alias = yield* Bedrock.AgentAlias("prod", {
 *   agentId: agent.agentId,
 *   routingConfiguration: [{ agentVersion: "3" }],
 * });
 * ```
 *
 * @resource
 */
export const AgentAlias = Resource("AWS.Bedrock.AgentAlias");
/** Alias status values indicating an in-flight transition to wait out. */
const ALIAS_TRANSIENT = new Set(["CREATING", "UPDATING"]);
export const AgentAliasProvider = () => Provider.effect(AgentAlias, Effect.gen(function* () {
    const createName = Effect.fn(function* (id, props) {
        return (props.agentAliasName ??
            (yield* createPhysicalName({ id, maxLength: 100 })));
    });
    const getAliasOrUndefined = Effect.fn(function* (agentId, agentAliasId) {
        return yield* bedrock.getAgentAlias({ agentId, agentAliasId }).pipe(Effect.map((r) => r.agentAlias), Effect.catchTag("ResourceNotFoundException", () => Effect.succeed(undefined)));
    });
    const findByName = Effect.fn(function* (agentId, name) {
        const pages = yield* bedrock.listAgentAliases
            .pages({ agentId })
            .pipe(Stream.runCollect);
        return Array.from(pages)
            .flatMap((page) => page.agentAliasSummaries ?? [])
            .find((s) => s.agentAliasName === name)?.agentAliasId;
    });
    const fetchObservedTags = Effect.fn(function* (resourceArn) {
        return yield* bedrock.listTagsForResource({ resourceArn }).pipe(Effect.map((r) => (r.tags ?? {})), Effect.catchTag("ResourceNotFoundException", () => Effect.succeed({})));
    });
    const waitForSettled = Effect.fn(function* (agentId, agentAliasId) {
        return yield* bedrock.getAgentAlias({ agentId, agentAliasId }).pipe(Effect.map((r) => r.agentAlias), Effect.catchTag("ResourceNotFoundException", () => Effect.succeed(undefined)), Effect.repeat({
            schedule: Schedule.fixed("3 seconds"),
            until: (alias) => alias === undefined ||
                !ALIAS_TRANSIENT.has(alias.agentAliasStatus),
            times: 40,
        }));
    });
    return AgentAlias.Provider.of({
        stables: ["agentId", "agentAliasId", "agentAliasArn", "agentAliasName"],
        // Aliases are scoped to a parent agent — enumeration requires the
        // agent id, so this returns empty (the engine keys off state).
        list: () => Effect.succeed([]),
        read: Effect.fn(function* ({ id, olds, output }) {
            const agentId = output?.agentId ?? olds?.agentId;
            if (agentId === undefined)
                return undefined;
            const aliasId = output?.agentAliasId ??
                (yield* findByName(agentId, output?.agentAliasName ??
                    (yield* createName(id, olds ?? {}))));
            if (aliasId === undefined)
                return undefined;
            const alias = yield* getAliasOrUndefined(agentId, aliasId);
            if (alias === undefined || alias.agentAliasStatus === "DELETING") {
                return undefined;
            }
            const attrs = {
                agentId: alias.agentId,
                agentAliasId: alias.agentAliasId,
                agentAliasArn: alias.agentAliasArn,
                agentAliasName: alias.agentAliasName,
            };
            const tags = yield* fetchObservedTags(alias.agentAliasArn);
            return (yield* hasAlchemyTags(id, tags)) ? attrs : Unowned(attrs);
        }),
        diff: Effect.fn(function* ({ id, news, olds }) {
            if (!isResolved(news))
                return undefined;
            if ((olds?.agentId ?? undefined) !== (news?.agentId ?? undefined)) {
                return { action: "replace" };
            }
            const oldName = yield* createName(id, olds ?? {});
            const newName = yield* createName(id, news ?? {});
            if (oldName !== newName) {
                return { action: "replace" };
            }
            // description, routingConfiguration, and tags converge via update.
        }),
        reconcile: Effect.fn(function* ({ id, news = {}, output, session, }) {
            const name = output?.agentAliasName ?? (yield* createName(id, news));
            const agentId = news.agentId;
            const internalTags = yield* createInternalTags(id);
            const desiredTags = { ...news.tags, ...internalTags };
            // 1. OBSERVE
            let alias = output?.agentAliasId
                ? yield* getAliasOrUndefined(agentId, output.agentAliasId)
                : undefined;
            if (alias === undefined) {
                const foundId = yield* findByName(agentId, name);
                if (foundId !== undefined) {
                    alias = yield* getAliasOrUndefined(agentId, foundId);
                }
            }
            if (alias === undefined) {
                // 2. ENSURE
                const created = yield* bedrock.createAgentAlias({
                    agentId,
                    agentAliasName: name,
                    description: news.description,
                    routingConfiguration: news.routingConfiguration,
                    tags: desiredTags,
                });
                alias = created.agentAlias;
                alias =
                    (yield* waitForSettled(agentId, alias.agentAliasId)) ?? alias;
            }
            else {
                // 3. SYNC
                alias =
                    (yield* waitForSettled(agentId, alias.agentAliasId)) ?? alias;
                yield* bedrock.updateAgentAlias({
                    agentId,
                    agentAliasId: alias.agentAliasId,
                    agentAliasName: name,
                    description: news.description,
                    routingConfiguration: news.routingConfiguration,
                });
                alias =
                    (yield* waitForSettled(agentId, alias.agentAliasId)) ?? alias;
            }
            const agentAliasId = alias.agentAliasId;
            const agentAliasArn = alias.agentAliasArn;
            // 3b. SYNC TAGS against observed cloud tags.
            const observedTags = yield* fetchObservedTags(agentAliasArn);
            const { upsert, removed } = diffTags(observedTags, desiredTags);
            if (upsert.length > 0) {
                yield* bedrock.tagResource({
                    resourceArn: agentAliasArn,
                    tags: Object.fromEntries(upsert.map(({ Key, Value }) => [Key, Value])),
                });
            }
            if (removed.length > 0) {
                yield* bedrock.untagResource({
                    resourceArn: agentAliasArn,
                    tagKeys: removed,
                });
            }
            yield* session.note(agentAliasArn);
            return {
                agentId,
                agentAliasId,
                agentAliasArn,
                agentAliasName: name,
            };
        }),
        delete: Effect.fn(function* ({ output }) {
            yield* bedrock
                .deleteAgentAlias({
                agentId: output.agentId,
                agentAliasId: output.agentAliasId,
            })
                .pipe(Effect.catchTag("ResourceNotFoundException", () => Effect.void));
        }),
    });
}));
//# sourceMappingURL=AgentAlias.js.map