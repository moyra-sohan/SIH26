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
 * A custom Amazon Bedrock AgentCore Browser — a managed, isolated cloud
 * browser that agents drive to interact with websites.
 *
 * A custom browser controls the sandbox's network mode, execution role, and
 * session recording. All configuration is create-only (the API has no update
 * operation); property changes trigger a replacement.
 *
 * ### Creating Browsers
 * **Example:** Public-Egress Browser
 * ```typescript
 * import * as AgentCore from "alchemy/AWS/BedrockAgentCore";
 *
 * const browser = yield* AgentCore.BrowserCustom("AgentBrowser", {});
 * ```
 *
 * **Example:** Browser with Session Recording
 * ```typescript
 * const browser = yield* AgentCore.BrowserCustom("RecordedBrowser", {
 *   executionRoleArn: role.roleArn,
 *   recording: {
 *     enabled: true,
 *     s3Location: { bucket: bucket.bucketName, prefix: "sessions/" },
 *   },
 * });
 * ```
 *
 * @resource
 */
export const BrowserCustom = Resource("AWS.BedrockAgentCore.BrowserCustom");
export const BrowserCustomProvider = () => Provider.effect(BrowserCustom, Effect.gen(function* () {
    const createName = Effect.fn(function* (id, props) {
        return props.name ?? (yield* createAgentCoreName(id));
    });
    // getBrowser still resolves soft-deleted browsers — DELETED/DELETING
    // count as gone.
    const getLiveOrUndefined = Effect.fn(function* (browserId) {
        const found = yield* control
            .getBrowser({ browserId })
            .pipe(Effect.catchTag("ResourceNotFoundException", () => Effect.succeed(undefined)));
        return found === undefined ||
            found.status === "DELETED" ||
            found.status === "DELETING"
            ? undefined
            : found;
    });
    const findByName = Effect.fn(function* (name) {
        const pages = yield* control.listBrowsers
            .pages({})
            .pipe(Stream.runCollect);
        const summary = Array.from(pages)
            .flatMap((page) => page.browserSummaries ?? [])
            .find((s) => s.name === name &&
            s.status !== "DELETED" &&
            s.status !== "DELETING");
        return summary === undefined
            ? undefined
            : yield* getLiveOrUndefined(summary.browserId);
    });
    const toAttributes = (browser) => ({
        browserId: browser.browserId,
        browserArn: browser.browserArn,
        name: browser.name,
        status: browser.status,
    });
    return BrowserCustom.Provider.of({
        stables: ["browserId", "browserArn", "name"],
        list: () => Effect.gen(function* () {
            const pages = yield* control.listBrowsers
                .pages({})
                .pipe(Stream.runCollect);
            const summaries = Array.from(pages)
                .flatMap((page) => page.browserSummaries ?? [])
                .filter((s) => s.status !== "DELETED" && s.status !== "DELETING");
            const hydrated = yield* Effect.forEach(summaries, (s) => getLiveOrUndefined(s.browserId), { concurrency: 5 });
            return hydrated.filter((b) => b !== undefined).map(toAttributes);
        }),
        read: Effect.fn(function* ({ id, olds, output }) {
            const browser = output?.browserId
                ? yield* getLiveOrUndefined(output.browserId)
                : yield* findByName(yield* createName(id, olds ?? {}));
            if (browser === undefined)
                return undefined;
            const attrs = toAttributes(browser);
            const tags = yield* readAgentCoreTags(browser.browserArn);
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
                JSON.stringify(oldProps.networkConfiguration ?? { networkMode: "PUBLIC" }) !==
                    JSON.stringify(newProps.networkConfiguration ?? { networkMode: "PUBLIC" }) ||
                JSON.stringify(oldProps.recording ?? null) !==
                    JSON.stringify(newProps.recording ?? null)) {
                return { action: "replace" };
            }
        }),
        reconcile: Effect.fn(function* ({ id, news, output, session }) {
            const props = news ?? {};
            const name = output?.name ?? (yield* createName(id, props));
            const internalTags = yield* createInternalTags(id);
            const desiredTags = { ...props.tags, ...internalTags };
            // 1. OBSERVE
            let browser = output?.browserId
                ? yield* getLiveOrUndefined(output.browserId)
                : undefined;
            if (browser === undefined) {
                browser = yield* findByName(name);
            }
            // 2. ENSURE — creation is synchronous (READY on return); tolerate
            // the name-exists race and transient IAM propagation.
            if (browser === undefined) {
                const created = yield* control
                    .createBrowser({
                    name,
                    description: props.description,
                    executionRoleArn: props.executionRoleArn,
                    networkConfiguration: props.networkConfiguration ?? {
                        networkMode: "PUBLIC",
                    },
                    recording: props.recording,
                    tags: desiredTags,
                })
                    .pipe(retryWhileValidation, Effect.catchTag("ConflictException", () => Effect.succeed(undefined)));
                browser =
                    created === undefined
                        ? yield* findByName(name)
                        : yield* getLiveOrUndefined(created.browserId);
            }
            if (browser === undefined) {
                return yield* new AgentCoreProvisioningFailed({
                    message: `browser '${name}' was neither created nor found`,
                });
            }
            if (browser.status === "CREATE_FAILED") {
                return yield* new AgentCoreProvisioningFailed({
                    message: `browser '${name}' failed: ${browser.failureReason ?? "unknown"}`,
                });
            }
            // 3. SYNC — only tags are mutable.
            yield* syncAgentCoreTags(browser.browserArn, desiredTags);
            // 4. RETURN fresh attributes.
            yield* session.note(browser.browserId);
            return toAttributes(browser);
        }),
        delete: Effect.fn(function* ({ output }) {
            yield* control.deleteBrowser({ browserId: output.browserId }).pipe(retryWhileConflict, Effect.catchTag("ResourceNotFoundException", () => Effect.succeed(undefined)));
            yield* control.getBrowser({ browserId: output.browserId }).pipe(Effect.map((b) => b.status), Effect.catchTag("ResourceNotFoundException", () => Effect.succeed("DELETED")), Effect.repeat({
                schedule: Schedule.fixed("3 seconds"),
                until: (status) => status === "DELETED" || status === "DELETE_FAILED",
                times: 20,
            }));
        }),
    });
}));
//# sourceMappingURL=BrowserCustom.js.map