import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import * as Output from "../../Output.js";
import { AWSEnvironment } from "../Environment.js";
import { isBindingHost } from "../Lambda/Function.js";
import { bedrockModelArns } from "./ModelArns.js";
/**
 * Shared scaffolding for Bedrock HTTP bindings.
 *
 * NOT exported from `index.ts` — every thin `{Op}Http.ts` in this service is
 * a `Layer.effect(Cap, make…HttpBinding({ … }))` over one of the builders
 * below. Everything except the operation, the IAM action list, and the
 * injected identifier(s) is boilerplate. Genuinely-different bindings
 * (e.g. `Rerank`, which grants a wildcard `bedrock:Rerank` alongside
 * model-scoped `bedrock:InvokeModel`) stay bespoke.
 */
const currentEnv = AWSEnvironment.current;
/**
 * Build the impl Effect for a model-scoped `bedrock-runtime` operation whose
 * request carries a top-level `modelId`. The binding accepts one or more
 * model references (foundation-model id, cross-region inference profile id,
 * or full ARN), grants `actions` on exactly the resolved model ARNs, and the
 * runtime callable defaults `modelId` to the first bound model.
 */
export const makeModelScopedHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (model, ...additionalModels) {
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                const { accountId, region } = yield* currentEnv;
                // Sort so the binding identity (SID + ARN list) is deterministic
                // regardless of argument order.
                const sorted = [...new Set([model, ...additionalModels])].sort();
                yield* host.bind `Allow(${host}, ${options.tag}(${sorted.join(",")}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: [
                                ...new Set(sorted.flatMap((id) => bedrockModelArns(region, accountId, id))),
                            ],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${model})`)(function* (request) {
            return yield* op({
                ...request,
                modelId: request.modelId ?? model,
            });
        });
    });
});
/**
 * Build the impl Effect for a knowledge-base-scoped `bedrock-agent-runtime`
 * operation whose request carries a top-level `knowledgeBaseId`. The binding
 * grants `actions` on the bound {@link KnowledgeBase}'s ARN and the runtime
 * callable injects its `knowledgeBaseId`.
 */
export const makeKnowledgeBaseScopedHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (knowledgeBase) {
        const KnowledgeBaseId = yield* knowledgeBase.knowledgeBaseId;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${knowledgeBase}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: [knowledgeBase.knowledgeBaseArn],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${knowledgeBase.LogicalId})`)(function* (request) {
            return yield* op({
                ...request,
                knowledgeBaseId: yield* KnowledgeBaseId,
            });
        });
    });
});
/**
 * Build the impl Effect for a data-source-scoped `bedrock-agent` operation
 * whose request carries top-level `knowledgeBaseId` + `dataSourceId`
 * (ingestion jobs, direct document ingestion). Bedrock authorizes these
 * actions against the parent knowledge-base ARN, so the deploy-time half
 * grants `actions` on the bound {@link DataSource}'s knowledge base; the
 * runtime callable injects both identifiers.
 */
export const makeDataSourceScopedHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (dataSource) {
        const KnowledgeBaseId = yield* dataSource.knowledgeBaseId;
        const DataSourceId = yield* dataSource.dataSourceId;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                const { accountId, region } = yield* currentEnv;
                yield* host.bind `Allow(${host}, ${options.tag}(${dataSource}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: [
                                dataSource.knowledgeBaseId.pipe(Output.map((id) => `arn:aws:bedrock:${region}:${accountId}:knowledge-base/${id}`)),
                            ],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${dataSource.LogicalId})`)(function* (request) {
            return yield* op({
                ...request,
                knowledgeBaseId: yield* KnowledgeBaseId,
                dataSourceId: yield* DataSourceId,
            });
        });
    });
});
/**
 * Build the impl Effect for an agent-alias-scoped `bedrock-agent-runtime`
 * operation whose request carries top-level `agentId` + `agentAliasId`. The
 * binding grants `actions` on the bound {@link AgentAlias}'s ARN and the
 * runtime callable injects both identifiers.
 */
export const makeAgentAliasScopedHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (alias) {
        const AgentId = yield* alias.agentId;
        const AgentAliasId = yield* alias.agentAliasId;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${alias}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: [alias.agentAliasArn],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${alias.LogicalId})`)(function* (request) {
            return yield* op({
                ...request,
                agentId: yield* AgentId,
                agentAliasId: yield* AgentAliasId,
            });
        });
    });
});
/**
 * Build the impl Effect for a managed-RAG operation (`RetrieveAndGenerate` /
 * `RetrieveAndGenerateStream`). The binding grants `bedrock:Retrieve` +
 * `bedrock:RetrieveAndGenerate` on the bound {@link KnowledgeBase} plus
 * `bedrock:InvokeModel` scoped to the named generation models (or all
 * foundation models + cross-region inference profiles when none are named).
 * The request passes through unchanged — the knowledge base is referenced
 * inside `retrieveAndGenerateConfiguration`.
 */
export const makeRagHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (knowledgeBase, ...models) {
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                const { accountId, region } = yield* currentEnv;
                // Scope InvokeModel to the named models, or all foundation models +
                // cross-region inference profiles when the caller names none.
                const modelResources = models.length > 0
                    ? [
                        ...new Set(models.flatMap((id) => bedrockModelArns(region, accountId, id))),
                    ]
                    : [
                        `arn:aws:bedrock:${region}::foundation-model/*`,
                        `arn:aws:bedrock:${region}:${accountId}:inference-profile/*`,
                    ];
                yield* host.bind `Allow(${host}, ${options.tag}(${knowledgeBase}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: ["bedrock:Retrieve", "bedrock:RetrieveAndGenerate"],
                            Resource: [knowledgeBase.knowledgeBaseArn],
                        },
                        {
                            Effect: "Allow",
                            Action: ["bedrock:InvokeModel"],
                            Resource: modelResources,
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${knowledgeBase.LogicalId})`)(function* (request) {
            return yield* op(request);
        });
    });
});
//# sourceMappingURL=BindingHttp.js.map