import * as control from "@distilled.cloud/aws/bedrock-agentcore-control";
import * as Effect from "effect/Effect";
import * as Schedule from "effect/Schedule";
import * as Stream from "effect/Stream";
import { Unowned } from "../../AdoptPolicy.js";
import { isResolved } from "../../Diff.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
import { createInternalTags, hasAlchemyTags } from "../../Tags.js";
import { AgentCoreProvisioningFailed, createAgentCoreName, readAgentCoreTags, retryWhileConflict, retryWhileValidation, syncAgentCoreTags, } from "./internal.js";
/**
 * A custom Amazon Bedrock AgentCore Code Interpreter — an isolated sandbox
 * where agents execute Python/JavaScript/TypeScript code.
 *
 * A custom interpreter controls the sandbox's network mode and execution
 * role. All configuration is create-only (the API has no update operation);
 * property changes trigger a replacement.
 *
 * ### Creating Code Interpreters
 * **Example:** Sandboxed Interpreter (no network egress)
 * ```typescript
 * import * as AgentCore from "alchemy/AWS/BedrockAgentCore";
 *
 * const interpreter = yield* AgentCore.CodeInterpreter("Sandbox", {});
 * ```
 *
 * **Example:** Interpreter with Public Egress
 * ```typescript
 * const interpreter = yield* AgentCore.CodeInterpreter("PublicSandbox", {
 *   networkConfiguration: { networkMode: "PUBLIC" },
 * });
 * ```
 *
 * ### Executing Code from a Function
 * **Example:** Start a Session and Run Code
 * ```typescript
 * // init
 * const startSession = yield* AgentCore.StartCodeInterpreterSession(interpreter);
 * const invoke = yield* AgentCore.InvokeCodeInterpreter(interpreter);
 * const stopSession = yield* AgentCore.StopCodeInterpreterSession(interpreter);
 *
 * return {
 *   fetch: Effect.gen(function* () {
 *     // runtime
 *     const session = yield* startSession({ sessionTimeout: "5 minutes" });
 *     const result = yield* invoke({
 *       sessionId: session.sessionId,
 *       name: "executeCode",
 *       arguments: { language: "python", code: "print(1 + 1)" },
 *     });
 *     const output = yield* Stream.runCollect(result.stream);
 *     yield* stopSession({ sessionId: session.sessionId });
 *     return HttpServerResponse.json({ output: Array.from(output) });
 *   }),
 * };
 * ```
 *
 * @resource
 */
export const CodeInterpreter = Resource("AWS.BedrockAgentCore.CodeInterpreter");
export const CodeInterpreterProvider = () => Provider.effect(CodeInterpreter, Effect.gen(function* () {
    const createName = Effect.fn(function* (id, props) {
        return props.name ?? (yield* createAgentCoreName(id));
    });
    // getCodeInterpreter still resolves soft-deleted interpreters —
    // DELETED/DELETING count as gone.
    const getLiveOrUndefined = Effect.fn(function* (codeInterpreterId) {
        const found = yield* control
            .getCodeInterpreter({ codeInterpreterId })
            .pipe(Effect.catchTag("ResourceNotFoundException", () => Effect.succeed(undefined)));
        return found === undefined ||
            found.status === "DELETED" ||
            found.status === "DELETING"
            ? undefined
            : found;
    });
    const findByName = Effect.fn(function* (name) {
        const pages = yield* control.listCodeInterpreters
            .pages({})
            .pipe(Stream.runCollect);
        const summary = Array.from(pages)
            .flatMap((page) => page.codeInterpreterSummaries ?? [])
            .find((s) => s.name === name &&
            s.status !== "DELETED" &&
            s.status !== "DELETING");
        return summary === undefined
            ? undefined
            : yield* getLiveOrUndefined(summary.codeInterpreterId);
    });
    const toAttributes = (ci) => ({
        codeInterpreterId: ci.codeInterpreterId,
        codeInterpreterArn: ci.codeInterpreterArn,
        name: ci.name,
        status: ci.status,
    });
    return CodeInterpreter.Provider.of({
        stables: ["codeInterpreterId", "codeInterpreterArn", "name"],
        list: () => Effect.gen(function* () {
            const pages = yield* control.listCodeInterpreters
                .pages({})
                .pipe(Stream.runCollect);
            const summaries = Array.from(pages)
                .flatMap((page) => page.codeInterpreterSummaries ?? [])
                .filter((s) => s.status !== "DELETED" && s.status !== "DELETING");
            const hydrated = yield* Effect.forEach(summaries, (s) => getLiveOrUndefined(s.codeInterpreterId), { concurrency: 5 });
            return hydrated.filter((c) => c !== undefined).map(toAttributes);
        }),
        read: Effect.fn(function* ({ id, olds, output }) {
            const ci = output?.codeInterpreterId
                ? yield* getLiveOrUndefined(output.codeInterpreterId)
                : yield* findByName(yield* createName(id, olds ?? {}));
            if (ci === undefined)
                return undefined;
            const attrs = toAttributes(ci);
            const tags = yield* readAgentCoreTags(ci.codeInterpreterArn);
            return (yield* hasAlchemyTags(id, tags)) ? attrs : Unowned(attrs);
        }),
        // Everything except tags is create-only — any change replaces.
        diff: Effect.fn(function* ({ id, news, olds }) {
            if (!isResolved(news))
                return undefined;
            const oldProps = olds ?? {};
            const newProps = news ?? {};
            const oldName = yield* createName(id, oldProps);
            const newName = yield* createName(id, newProps);
            if (oldName !== newName ||
                (oldProps.description ?? undefined) !==
                    (newProps.description ?? undefined) ||
                (oldProps.executionRoleArn ?? undefined) !==
                    (newProps.executionRoleArn ?? undefined) ||
                JSON.stringify(oldProps.networkConfiguration ?? { networkMode: "SANDBOX" }) !==
                    JSON.stringify(newProps.networkConfiguration ?? { networkMode: "SANDBOX" })) {
                return { action: "replace" };
            }
        }),
        reconcile: Effect.fn(function* ({ id, news, output, session }) {
            const props = news ?? {};
            const name = output?.name ?? (yield* createName(id, props));
            const internalTags = yield* createInternalTags(id);
            const desiredTags = { ...props.tags, ...internalTags };
            // 1. OBSERVE
            let ci = output?.codeInterpreterId
                ? yield* getLiveOrUndefined(output.codeInterpreterId)
                : undefined;
            if (ci === undefined) {
                ci = yield* findByName(name);
            }
            // 2. ENSURE — creation is synchronous (READY on return); tolerate
            // the name-exists race and transient IAM propagation.
            if (ci === undefined) {
                const created = yield* control
                    .createCodeInterpreter({
                    name,
                    description: props.description,
                    executionRoleArn: props.executionRoleArn,
                    networkConfiguration: props.networkConfiguration ?? {
                        networkMode: "SANDBOX",
                    },
                    tags: desiredTags,
                })
                    .pipe(retryWhileValidation, Effect.catchTag("ConflictException", () => Effect.succeed(undefined)));
                ci =
                    created === undefined
                        ? yield* findByName(name)
                        : yield* getLiveOrUndefined(created.codeInterpreterId);
            }
            if (ci === undefined) {
                return yield* new AgentCoreProvisioningFailed({
                    message: `code interpreter '${name}' was neither created nor found`,
                });
            }
            if (ci.status === "CREATE_FAILED") {
                return yield* new AgentCoreProvisioningFailed({
                    message: `code interpreter '${name}' failed: ${ci.failureReason ?? "unknown"}`,
                });
            }
            // 3. SYNC — only tags are mutable.
            yield* syncAgentCoreTags(ci.codeInterpreterArn, desiredTags);
            // 4. RETURN fresh attributes.
            yield* session.note(ci.codeInterpreterId);
            return toAttributes(ci);
        }),
        delete: Effect.fn(function* ({ output }) {
            yield* control
                .deleteCodeInterpreter({
                codeInterpreterId: output.codeInterpreterId,
            })
                .pipe(retryWhileConflict, Effect.catchTag("ResourceNotFoundException", () => Effect.succeed(undefined)));
            // Deletion completes quickly (soft-delete to DELETED); wait until
            // it is out of the live set so a re-create of the same name works.
            yield* control
                .getCodeInterpreter({
                codeInterpreterId: output.codeInterpreterId,
            })
                .pipe(Effect.map((ci) => ci.status), Effect.catchTag("ResourceNotFoundException", () => Effect.succeed("DELETED")), Effect.repeat({
                schedule: Schedule.fixed("3 seconds"),
                until: (status) => status === "DELETED" || status === "DELETE_FAILED",
                times: 20,
            }));
        }),
    });
}));
//# sourceMappingURL=CodeInterpreter.js.map