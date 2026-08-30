import * as bedrock from "@distilled.cloud/aws/bedrock-agent";
import * as iam from "@distilled.cloud/aws/iam";
import * as Effect from "effect/Effect";
import * as Schedule from "effect/Schedule";
import * as Stream from "effect/Stream";
import { Unowned } from "../../AdoptPolicy.js";
import { isResolved } from "../../Diff.js";
import { createPhysicalName } from "../../PhysicalName.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
import { createInternalTags, diffTags, hasAlchemyTags } from "../../Tags.js";
import { toWireDays, toWireSeconds } from "../../Util/Duration.js";
import { AWSEnvironment } from "../Environment.js";
import { bedrockModelArns } from "./ModelArns.js";
/**
 * An Amazon Bedrock agent — a foundation model driven by natural-language
 * instructions that can orchestrate multi-step tasks.
 *
 * `Agent` owns the lifecycle of the agent's DRAFT version. An IAM execution
 * role is created automatically (trusted by `bedrock.amazonaws.com`, granted
 * `bedrock:InvokeModel` on the foundation model) unless an explicit
 * `agentResourceRoleArn` is supplied. After every create/update the agent is
 * prepared (unless `prepare: false`) so it is immediately invocable and can
 * back an {@link AgentAlias}.
 *
 * ### Creating Agents
 * **Example:** Minimal Agent
 * ```typescript
 * import * as Bedrock from "alchemy/AWS/Bedrock";
 *
 * const agent = yield* Bedrock.Agent("assistant", {
 *   foundationModel: "us.anthropic.claude-3-5-sonnet-20240620-v1:0",
 *   instruction:
 *     "You are a helpful assistant that answers questions concisely.",
 * });
 * ```
 *
 * **Example:** Agent with a Guardrail and Custom Session TTL
 * ```typescript
 * const agent = yield* Bedrock.Agent("assistant", {
 *   foundationModel: "us.anthropic.claude-3-5-sonnet-20240620-v1:0",
 *   instruction: "You are a careful, policy-compliant support agent.",
 *   idleSessionTTL: "30 minutes",
 *   guardrailConfiguration: {
 *     guardrailIdentifier: guardrail.guardrailId,
 *     guardrailVersion: "DRAFT",
 *   },
 * });
 * ```
 *
 * **Example:** Agent with Long-Term Memory
 * ```typescript
 * // Session summaries are retained for 30 days and readable at runtime
 * // through the GetAgentMemory binding.
 * const agent = yield* Bedrock.Agent("assistant", {
 *   foundationModel: "us.anthropic.claude-3-5-sonnet-20240620-v1:0",
 *   instruction: "You are a helpful assistant that remembers past sessions.",
 *   memoryConfiguration: {
 *     enabledMemoryTypes: ["SESSION_SUMMARY"],
 *     storage: "30 days",
 *   },
 * });
 * ```
 *
 * @resource
 */
export const Agent = Resource("AWS.Bedrock.Agent");
/** Map the declared memory props onto the wire `MemoryConfiguration`. */
const toWireMemoryConfiguration = (memory) => memory === undefined
    ? undefined
    : {
        enabledMemoryTypes: [...memory.enabledMemoryTypes],
        storageDays: toWireDays(memory.storage),
        sessionSummaryConfiguration: memory.sessionSummaryConfiguration,
    };
/** Agent status values from which no further transition is pending. */
const AGENT_SETTLED = new Set(["NOT_PREPARED", "PREPARED", "FAILED"]);
/** Agent status values indicating an in-flight transition to wait out. */
const AGENT_TRANSIENT = new Set([
    "CREATING",
    "UPDATING",
    "PREPARING",
    "VERSIONING",
]);
/**
 * A freshly created IAM role is eventually consistent; `createAgent` can
 * transiently reject a role it cannot yet assume with a `ValidationException`.
 * Wrapped in an explicitly-typed generic helper so the `Effect.retry`
 * conditional return type does not leak into declaration emit and widen the
 * provider layer's requirement to `unknown` (see PATTERNS §7).
 */
const retryWhileRoleAssumeFails = (self) => Effect.retry(self, {
    while: (e) => e._tag === "ValidationException" &&
        "message" in e &&
        typeof e.message === "string" &&
        e.message.toLowerCase().includes("unable to assume"),
    schedule: Schedule.max([Schedule.fixed("3 seconds"), Schedule.recurs(10)]),
});
export const AgentProvider = () => Provider.effect(Agent, Effect.gen(function* () {
    const createName = Effect.fn(function* (id, props) {
        return (props.agentName ?? (yield* createPhysicalName({ id, maxLength: 100 })));
    });
    const createRoleName = (id) => createPhysicalName({ id, maxLength: 64 });
    const getAgentOrUndefined = Effect.fn(function* (agentId) {
        return yield* bedrock.getAgent({ agentId }).pipe(Effect.map((r) => r.agent), Effect.catchTag("ResourceNotFoundException", () => Effect.succeed(undefined)));
    });
    const findByName = Effect.fn(function* (name) {
        const pages = yield* bedrock.listAgents
            .pages({})
            .pipe(Stream.runCollect);
        const summary = Array.from(pages)
            .flatMap((page) => page.agentSummaries ?? [])
            .find((s) => s.agentName === name);
        return summary?.agentId;
    });
    const fetchObservedTags = Effect.fn(function* (resourceArn) {
        return yield* bedrock.listTagsForResource({ resourceArn }).pipe(Effect.map((r) => (r.tags ?? {})), Effect.catchTag("ResourceNotFoundException", () => Effect.succeed({})));
    });
    // Poll the agent to a settled (non-transient) status. Bounded: creation
    // and preparation both complete within seconds to ~1 minute.
    const waitForSettled = Effect.fn(function* (agentId) {
        return yield* bedrock.getAgent({ agentId }).pipe(Effect.map((r) => r.agent), Effect.catchTag("ResourceNotFoundException", () => Effect.succeed(undefined)), Effect.repeat({
            schedule: Schedule.fixed("3 seconds"),
            until: (agent) => agent === undefined || !AGENT_TRANSIENT.has(agent.agentStatus),
            times: 40,
        }));
    });
    const ensureExecutionRole = Effect.fn(function* ({ id, roleName, region, accountId, foundationModel, }) {
        const tags = yield* createInternalTags(id);
        const role = yield* iam
            .createRole({
            RoleName: roleName,
            AssumeRolePolicyDocument: JSON.stringify({
                Version: "2012-10-17",
                Statement: [
                    {
                        Effect: "Allow",
                        Principal: { Service: "bedrock.amazonaws.com" },
                        Action: "sts:AssumeRole",
                        Condition: {
                            StringEquals: { "aws:SourceAccount": accountId },
                            ArnLike: {
                                "aws:SourceArn": `arn:aws:bedrock:${region}:${accountId}:agent/*`,
                            },
                        },
                    },
                ],
            }),
            Tags: Object.entries(tags).map(([Key, Value]) => ({ Key, Value })),
        })
            .pipe(Effect.catchTag("EntityAlreadyExistsException", () => iam.getRole({ RoleName: roleName })));
        yield* iam.putRolePolicy({
            RoleName: roleName,
            PolicyName: "BedrockAgentInvokeModel",
            PolicyDocument: JSON.stringify({
                Version: "2012-10-17",
                Statement: [
                    {
                        Effect: "Allow",
                        Action: [
                            "bedrock:InvokeModel",
                            "bedrock:InvokeModelWithResponseStream",
                        ],
                        Resource: bedrockModelArns(region, accountId, foundationModel),
                    },
                ],
            }),
        });
        return role.Role.Arn;
    });
    return Agent.Provider.of({
        stables: ["agentId", "agentArn", "agentName"],
        list: () => Effect.gen(function* () {
            const { region, accountId } = yield* AWSEnvironment.current;
            const pages = yield* bedrock.listAgents
                .pages({})
                .pipe(Stream.runCollect);
            const summaries = Array.from(pages).flatMap((page) => page.agentSummaries ?? []);
            return summaries.map((s) => ({
                agentId: s.agentId,
                agentArn: `arn:aws:bedrock:${region}:${accountId}:agent/${s.agentId}`,
                agentName: s.agentName,
                agentVersion: "DRAFT",
                agentResourceRoleArn: "",
                roleName: undefined,
            }));
        }),
        read: Effect.fn(function* ({ id, olds, output }) {
            const agentId = output?.agentId ??
                (yield* findByName(output?.agentName ??
                    (yield* createName(id, olds ?? {}))));
            if (agentId === undefined)
                return undefined;
            const agent = yield* getAgentOrUndefined(agentId);
            if (agent === undefined || agent.agentStatus === "DELETING") {
                return undefined;
            }
            const attrs = {
                agentId: agent.agentId,
                agentArn: agent.agentArn,
                agentName: agent.agentName,
                agentVersion: agent.agentVersion ?? "DRAFT",
                agentResourceRoleArn: agent.agentResourceRoleArn,
                roleName: output?.roleName,
            };
            const tags = yield* fetchObservedTags(agent.agentArn);
            return (yield* hasAlchemyTags(id, tags)) ? attrs : Unowned(attrs);
        }),
        diff: Effect.fn(function* ({ id, news, olds }) {
            if (!isResolved(news))
                return undefined;
            const oldName = yield* createName(id, olds ?? {});
            const newName = yield* createName(id, news ?? {});
            if (oldName !== newName) {
                return { action: "replace" };
            }
            // foundationModel, instruction, description, guardrail, TTL, and
            // tags all converge via updateAgent.
        }),
        reconcile: Effect.fn(function* ({ id, news = {}, output, session, }) {
            const { accountId, region } = yield* AWSEnvironment.current;
            const name = output?.agentName ?? (yield* createName(id, news));
            const internalTags = yield* createInternalTags(id);
            const desiredTags = { ...news.tags, ...internalTags };
            // Ensure the execution role first — the agent cannot exist without
            // one. Managed unless an explicit agentResourceRoleArn is provided.
            let roleArn = news.agentResourceRoleArn;
            let roleName = output?.roleName;
            if (roleArn === undefined) {
                roleName = roleName ?? (yield* createRoleName(id));
                roleArn = yield* ensureExecutionRole({
                    id,
                    roleName,
                    region,
                    accountId,
                    foundationModel: news.foundationModel,
                });
            }
            // 1. OBSERVE — cloud state is authoritative; output is only an id
            //    cache. Fall back to a name lookup after state loss.
            let agent = output?.agentId
                ? yield* getAgentOrUndefined(output.agentId)
                : undefined;
            if (agent === undefined) {
                const foundId = yield* findByName(name);
                if (foundId !== undefined) {
                    agent = yield* getAgentOrUndefined(foundId);
                }
            }
            if (agent === undefined) {
                // 2. ENSURE — create.
                const created = yield* retryWhileRoleAssumeFails(bedrock.createAgent({
                    agentName: name,
                    foundationModel: news.foundationModel,
                    instruction: news.instruction,
                    description: news.description,
                    agentResourceRoleArn: roleArn,
                    idleSessionTTLInSeconds: toWireSeconds(news.idleSessionTTL),
                    customerEncryptionKeyArn: news.customerEncryptionKeyArn,
                    guardrailConfiguration: news.guardrailConfiguration,
                    memoryConfiguration: toWireMemoryConfiguration(news.memoryConfiguration),
                    tags: desiredTags,
                }));
                agent = created.agent;
                agent = (yield* waitForSettled(agent.agentId)) ?? agent;
            }
            else {
                // 3. SYNC — wait for any in-flight transition, then update.
                agent = (yield* waitForSettled(agent.agentId)) ?? agent;
                yield* bedrock.updateAgent({
                    agentId: agent.agentId,
                    agentName: name,
                    foundationModel: news.foundationModel,
                    instruction: news.instruction,
                    description: news.description,
                    agentResourceRoleArn: roleArn,
                    idleSessionTTLInSeconds: toWireSeconds(news.idleSessionTTL),
                    customerEncryptionKeyArn: news.customerEncryptionKeyArn,
                    guardrailConfiguration: news.guardrailConfiguration,
                    memoryConfiguration: toWireMemoryConfiguration(news.memoryConfiguration),
                });
                agent = (yield* waitForSettled(agent.agentId)) ?? agent;
            }
            const agentId = agent.agentId;
            const agentArn = agent.agentArn;
            // 3b. SYNC TAGS — diff against OBSERVED cloud tags (create-time tags
            //     only apply on first create; adoption may carry foreign tags).
            const observedTags = yield* fetchObservedTags(agentArn);
            const { upsert, removed } = diffTags(observedTags, desiredTags);
            if (upsert.length > 0) {
                yield* bedrock.tagResource({
                    resourceArn: agentArn,
                    tags: Object.fromEntries(upsert.map(({ Key, Value }) => [Key, Value])),
                });
            }
            if (removed.length > 0) {
                yield* bedrock.untagResource({
                    resourceArn: agentArn,
                    tagKeys: removed,
                });
            }
            // 4. PREPARE — compile the DRAFT so the agent is invocable and can
            //    back an alias. Bounded poll to PREPARED/FAILED.
            if (news.prepare !== false) {
                yield* bedrock.prepareAgent({ agentId });
                agent = (yield* waitForSettled(agentId)) ?? agent;
            }
            yield* session.note(agentArn);
            return {
                agentId,
                agentArn,
                agentName: name,
                agentVersion: agent.agentVersion ?? "DRAFT",
                agentResourceRoleArn: roleArn,
                roleName,
            };
        }),
        delete: Effect.fn(function* ({ output }) {
            yield* bedrock
                .deleteAgent({
                agentId: output.agentId,
                skipResourceInUseCheck: true,
            })
                .pipe(Effect.catchTag("ResourceNotFoundException", () => Effect.void));
            // Tear down the managed execution role (absent when an explicit
            // agentResourceRoleArn was supplied). Every step tolerates a
            // partially or fully removed role.
            if (output.roleName !== undefined) {
                const roleName = output.roleName;
                yield* iam
                    .deleteRolePolicy({
                    RoleName: roleName,
                    PolicyName: "BedrockAgentInvokeModel",
                })
                    .pipe(Effect.catchTag("NoSuchEntityException", () => Effect.void));
                yield* iam
                    .deleteRole({ RoleName: roleName })
                    .pipe(Effect.catchTag("NoSuchEntityException", () => Effect.void));
            }
        }),
    });
}));
//# sourceMappingURL=Agent.js.map