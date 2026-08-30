import * as securitylake from "@distilled.cloud/aws/securitylake";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Stream from "effect/Stream";
import { isResolved } from "../../Diff.js";
import { createPhysicalName } from "../../PhysicalName.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
import { retryWhileConflict } from "./internal.js";
/**
 * A custom (third-party) log source registered with Amazon Security Lake.
 * Security Lake provisions a Glue crawler, database, and table for the
 * source, plus an IAM role the provider assumes to write OCSF-formatted data
 * into the data lake. Requires `SecurityLake.DataLake` to already be enabled
 * in the Region.
 *
 * Every configuration property is create-only — changing any of them
 * replaces the source.
 *
 * ### Registering a custom source
 * **Example:** Custom source with a crawler role
 * ```typescript
 * const custom = yield* SecurityLake.CustomLogSource("AppLogs", {
 *   sourceName: "my-app-logs",
 *   eventClasses: ["FILE_ACTIVITY"],
 *   crawlerConfiguration: { roleArn: crawlerRole.roleArn },
 *   providerIdentity: {
 *     principal: "123456789012",
 *     externalId: "my-app-external-id",
 *   },
 * });
 * ```
 */
const CustomLogSourceResource = Resource("AWS.SecurityLake.CustomLogSource");
export { CustomLogSourceResource as CustomLogSource };
const buildAttrs = (source) => ({
    sourceName: source.sourceName,
    sourceVersion: source.sourceVersion,
    crawlerArn: source.attributes?.crawlerArn,
    databaseArn: source.attributes?.databaseArn,
    tableArn: source.attributes?.tableArn,
    providerRoleArn: source.provider?.roleArn,
    providerLocation: source.provider?.location,
});
export const CustomLogSourceProvider = () => Provider.effect(CustomLogSourceResource, Effect.gen(function* () {
    const createName = Effect.fn(function* (id, props) {
        return (props.sourceName ?? (yield* createPhysicalName({ id, maxLength: 64 })));
    });
    // listLogSources reports only the source identity (name + version) for
    // custom sources — the Glue/provider attributes are only returned by
    // createCustomLogSource, so `output` is the cache for those.
    const findByName = (sourceName, sourceVersion) => securitylake.listLogSources.items({}).pipe(Stream.map((entry) => entry.sources ?? []), Stream.flattenIterable, Stream.filter((source) => source.customLogSource?.sourceName === sourceName &&
        (sourceVersion === undefined ||
            source.customLogSource.sourceVersion === sourceVersion)), Stream.take(1), Stream.runHead, Effect.map(Option.getOrUndefined), Effect.map((source) => source?.customLogSource));
    return {
        read: Effect.fn(function* ({ id, olds, output }) {
            const sourceName = output?.sourceName ?? (yield* createName(id, olds ?? {}));
            const sourceVersion = output?.sourceVersion ?? olds?.sourceVersion;
            // An account that never onboarded Security Lake rejects
            // listLogSources — that means "no source", not a failure.
            const observed = yield* findByName(sourceName, sourceVersion).pipe(Effect.catchTag([
                "AccessDeniedException",
                "ResourceNotFoundException",
                "UnauthorizedException",
            ], () => Effect.succeed(undefined)));
            if (observed === undefined)
                return undefined;
            // Custom log sources carry no tags, so ownership can't be
            // distinguished — read reports observed state (merged with cached
            // create-time attributes).
            return {
                sourceName,
                sourceVersion: observed.sourceVersion ?? sourceVersion,
                crawlerArn: output?.crawlerArn,
                databaseArn: output?.databaseArn,
                tableArn: output?.tableArn,
                providerRoleArn: output?.providerRoleArn,
                providerLocation: output?.providerLocation,
            };
        }),
        list: () => securitylake.listLogSources.items({}).pipe(Stream.map((entry) => entry.sources ?? []), Stream.flattenIterable, Stream.runCollect, Effect.map((entries) => {
            const seen = new Set();
            const attrs = [];
            for (const entry of entries) {
                const source = entry.customLogSource;
                if (source?.sourceName === undefined)
                    continue;
                const key = `${source.sourceName}@${source.sourceVersion ?? ""}`;
                if (seen.has(key))
                    continue;
                seen.add(key);
                attrs.push(buildAttrs(source));
            }
            return attrs;
        }), 
        // An account that never onboarded Security Lake has no data lake
        // to list sources for.
        Effect.catchTag([
            "AccessDeniedException",
            "ResourceNotFoundException",
            "UnauthorizedException",
        ], () => Effect.succeed([]))),
        // There is no UpdateCustomLogSource — every property is create-only.
        diff: Effect.fn(function* ({ news, olds }) {
            if (!isResolved(news))
                return undefined;
            const changed = news.sourceName !== olds.sourceName ||
                news.sourceVersion !== olds.sourceVersion ||
                JSON.stringify(news.eventClasses ?? []) !==
                    JSON.stringify(olds.eventClasses ?? []) ||
                news.crawlerConfiguration.roleArn !==
                    olds.crawlerConfiguration.roleArn ||
                news.providerIdentity.principal !==
                    olds.providerIdentity.principal ||
                news.providerIdentity.externalId !==
                    olds.providerIdentity.externalId;
            if (changed)
                return { action: "replace" };
        }),
        reconcile: Effect.fn(function* ({ id, news, output, session }) {
            const sourceName = yield* createName(id, news);
            // 1. OBSERVE — is the source already registered?
            const observed = yield* findByName(sourceName, news.sourceVersion);
            // 2. ENSURE — create when missing. A ConflictException means a
            // concurrent create won the race; fall through to observation.
            let attrs = output;
            if (observed === undefined) {
                const created = yield* securitylake
                    .createCustomLogSource({
                    sourceName,
                    sourceVersion: news.sourceVersion,
                    eventClasses: news.eventClasses,
                    configuration: {
                        crawlerConfiguration: news.crawlerConfiguration,
                        providerIdentity: news.providerIdentity,
                    },
                })
                    .pipe(Effect.map((response) => response.source), 
                // A concurrent create won the race — keep cached attributes.
                Effect.catchTag("ConflictException", () => Effect.succeed(undefined)));
                if (created !== undefined) {
                    attrs = buildAttrs(created);
                }
            }
            // 3. RETURN — merge observed identity with cached create-time
            // attributes (Glue ARNs / provider role are only reported by
            // create).
            const final = {
                sourceName,
                sourceVersion: attrs?.sourceVersion ??
                    observed?.sourceVersion ??
                    news.sourceVersion,
                crawlerArn: attrs?.crawlerArn,
                databaseArn: attrs?.databaseArn,
                tableArn: attrs?.tableArn,
                providerRoleArn: attrs?.providerRoleArn,
                providerLocation: attrs?.providerLocation,
            };
            yield* session.note(sourceName);
            return final;
        }),
        delete: Effect.fn(function* ({ output }) {
            yield* securitylake
                .deleteCustomLogSource({
                sourceName: output.sourceName,
                sourceVersion: output.sourceVersion,
            })
                .pipe(retryWhileConflict, 
            // Gone already, or the data lake itself was offboarded first.
            Effect.catchTag([
                "AccessDeniedException",
                "ResourceNotFoundException",
                "UnauthorizedException",
            ], () => Effect.void));
        }),
    };
}));
//# sourceMappingURL=CustomLogSource.js.map