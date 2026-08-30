import * as Lambda from "@distilled.cloud/aws/lambda";
import * as Effect from "effect/Effect";
import * as Schedule from "effect/Schedule";
import * as Stream from "effect/Stream";
import { deepEqual, isResolved } from "../../Diff.js";
import { createPhysicalName } from "../../PhysicalName.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
import { AWSEnvironment } from "../Environment.js";
import { syncEventInvokeConfig, } from "./EventInvokeConfig.js";
const resolvedProps = (props) => props;
/**
 * A Lambda alias for routing invocations to a stable function version.
 *
 * ### Creating Aliases
 * **Example:** Production Alias
 * ```typescript
 * const version = yield* Version("ProductionVersion", { function: fn });
 * const alias = yield* Alias("ProductionAlias", {
 *   version,
 *   aliasName: "production",
 * });
 * ```
 *
 * ### Weighted Routing
 * **Example:** Shift Traffic to Another Version
 * ```typescript
 * const version = yield* Version("LiveVersion", { function: fn });
 * const alias = yield* Alias("LiveAlias", {
 *   version,
 *   aliasName: "live",
 *   routingConfig: {
 *     AdditionalVersionWeights: {
 *       "3": 0.1,
 *     },
 *   },
 * });
 * ```
 *
 * ### Async Invocation
 * **Example:** Alias-Scoped Retry Behavior
 * ```typescript
 * const version = yield* Version("LiveVersion", { function: fn });
 * const alias = yield* Alias("LiveAlias", {
 *   version,
 *   aliasName: "live",
 *   eventInvokeConfig: {
 *     maximumRetryAttempts: 0,
 *     destinationConfig: {
 *       OnFailure: {
 *         Destination: queue.queueArn,
 *       },
 *     },
 *   },
 * });
 * ```
 */
export const Alias = Resource("AWS.Lambda.Alias");
const normalizeRoutingConfig = (config) => {
    const weights = Object.fromEntries(Object.entries(config?.AdditionalVersionWeights ?? {}).filter((entry) => entry[1] !== undefined));
    return Object.keys(weights).length > 0
        ? { AdditionalVersionWeights: weights }
        : undefined;
};
export const AliasProvider = () => Provider.effect(Alias, Effect.gen(function* () {
    const createAliasName = (id, aliasName) => aliasName
        ? Effect.succeed(aliasName)
        : createPhysicalName({
            id,
            maxLength: 128,
            delimiter: "-",
        });
    const retryOnAliasConflict = (effect) => effect.pipe(Effect.retry({
        while: (e) => e._tag === "ResourceConflictException",
        schedule: Schedule.max([
            Schedule.exponential(500),
            Schedule.recurs(10),
        ]),
    }));
    const snapshotAlias = (functionName, alias, region) => {
        if (!alias.AliasArn || !alias.Name || !alias.FunctionVersion) {
            return undefined;
        }
        return {
            aliasArn: alias.AliasArn,
            aliasName: alias.Name,
            functionName,
            functionVersion: alias.FunctionVersion,
            invokeArn: `arn:aws:apigateway:${region}:lambda:path/2015-03-31/functions/${alias.AliasArn}/invocations`,
            description: alias.Description || undefined,
            routingConfig: normalizeRoutingConfig(alias.RoutingConfig),
            revisionId: alias.RevisionId,
        };
    };
    return {
        stables: ["aliasArn", "aliasName", "functionName"],
        diff: Effect.fn(function* ({ id, olds, news }) {
            if (!isResolved(news))
                return;
            const resolvedOlds = resolvedProps(olds);
            const resolvedNews = resolvedProps(news);
            const oldAliasName = yield* createAliasName(id, resolvedOlds.aliasName);
            const newAliasName = yield* createAliasName(id, resolvedNews.aliasName);
            if (resolvedOlds.version.functionName !==
                resolvedNews.version.functionName ||
                oldAliasName !== newAliasName) {
                return { action: "replace" };
            }
        }),
        read: Effect.fn(function* ({ id, olds, output }) {
            const functionName = output?.functionName ??
                (olds ? resolvedProps(olds).version.functionName : undefined);
            if (!functionName)
                return undefined;
            const aliasName = output?.aliasName ??
                (yield* createAliasName(id, olds ? resolvedProps(olds).aliasName : undefined));
            const { region } = yield* AWSEnvironment.current;
            const alias = yield* Lambda.getAlias({
                FunctionName: functionName,
                Name: aliasName,
            }).pipe(Effect.catchTag("ResourceNotFoundException", () => Effect.succeed(undefined)));
            return alias ? snapshotAlias(functionName, alias, region) : undefined;
        }),
        list: () => Effect.gen(function* () {
            const { region } = yield* AWSEnvironment.current;
            const functionNames = yield* Lambda.listFunctions.pages({}).pipe(Stream.runCollect, Effect.map((chunk) => Array.from(chunk).flatMap((page) => (page.Functions ?? [])
                .map((fn) => fn.FunctionName)
                .filter((name) => name !== undefined))));
            const aliases = yield* Effect.forEach(functionNames, (functionName) => Lambda.listAliases.items({ FunctionName: functionName }).pipe(Stream.runCollect, Effect.map((chunk) => Array.from(chunk).flatMap((alias) => {
                const attrs = snapshotAlias(functionName, alias, region);
                return attrs ? [attrs] : [];
            })), Effect.catchTag("ResourceNotFoundException", () => Effect.succeed([]))), { concurrency: 10 });
            return aliases.flat();
        }),
        reconcile: Effect.fn(function* ({ id, news, output, session }) {
            const resolvedNews = resolvedProps(news);
            const functionName = resolvedNews.version.functionName;
            const functionVersion = resolvedNews.version.version;
            const { region } = yield* AWSEnvironment.current;
            const aliasName = output?.aliasName ??
                (yield* createAliasName(id, resolvedNews.aliasName));
            const desiredRoutingConfig = normalizeRoutingConfig(resolvedNews.routingConfig);
            const getAlias = Lambda.getAlias({
                FunctionName: functionName,
                Name: aliasName,
            }).pipe(Effect.catchTag("ResourceNotFoundException", () => Effect.succeed(undefined)));
            let alias = yield* getAlias;
            if (!alias) {
                alias = yield* Lambda.createAlias({
                    FunctionName: functionName,
                    Name: aliasName,
                    FunctionVersion: functionVersion,
                    Description: resolvedNews.description,
                    RoutingConfig: desiredRoutingConfig,
                }).pipe(Effect.catchTag("ResourceConflictException", () => getAlias));
            }
            const observedRoutingConfig = normalizeRoutingConfig(alias?.RoutingConfig);
            if (!alias ||
                alias.FunctionVersion !== functionVersion ||
                (alias.Description || undefined) !== resolvedNews.description ||
                !deepEqual(observedRoutingConfig, desiredRoutingConfig)) {
                alias = yield* retryOnAliasConflict(Lambda.updateAlias({
                    FunctionName: functionName,
                    Name: aliasName,
                    FunctionVersion: functionVersion,
                    Description: resolvedNews.description ?? "",
                    RoutingConfig: desiredRoutingConfig ??
                        (observedRoutingConfig
                            ? { AdditionalVersionWeights: {} }
                            : undefined),
                }));
            }
            const attrs = snapshotAlias(functionName, alias, region);
            if (!attrs) {
                return yield* Effect.die(`Lambda alias ${aliasName} did not return complete attributes.`);
            }
            yield* syncEventInvokeConfig({
                functionName,
                qualifier: attrs.aliasName,
                config: resolvedNews.eventInvokeConfig,
            });
            yield* session.note(`Alias ${attrs.aliasName} on ${attrs.functionName}`);
            return attrs;
        }),
        delete: Effect.fn(function* ({ output }) {
            // The alias-scoped async config does not die with the alias — clear
            // it first so a later alias of the same name starts clean.
            yield* syncEventInvokeConfig({
                functionName: output.functionName,
                qualifier: output.aliasName,
                config: undefined,
            });
            yield* retryOnAliasConflict(Lambda.deleteAlias({
                FunctionName: output.functionName,
                Name: output.aliasName,
            })).pipe(Effect.catchTag("ResourceNotFoundException", () => Effect.void));
        }),
    };
}));
//# sourceMappingURL=Alias.js.map