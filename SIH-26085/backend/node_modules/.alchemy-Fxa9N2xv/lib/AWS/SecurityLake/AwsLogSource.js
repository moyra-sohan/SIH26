import * as securitylake from "@distilled.cloud/aws/securitylake";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";
import { isResolved } from "../../Diff.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
/**
 * A natively supported AWS log source (Route 53, VPC Flow Logs, CloudTrail,
 * Security Hub findings, ...) enabled for collection into the Security Lake
 * data lake. Requires `SecurityLake.DataLake` to already be enabled in every
 * configured Region.
 *
 * ### Collecting AWS logs
 * **Example:** Route 53 resolver query logs
 * ```typescript
 * const lake = yield* SecurityLake.DataLake("Lake", {
 *   configurations: [{ region: "us-west-2" }],
 *   metaStoreManagerRoleArn: metastoreRole.roleArn,
 * });
 * const route53 = yield* SecurityLake.AwsLogSource("Route53Logs", {
 *   sourceName: "ROUTE53",
 *   regions: lake.regions,
 * });
 * ```
 *
 * **Example:** VPC Flow Logs from specific accounts
 * ```typescript
 * const vpcFlow = yield* SecurityLake.AwsLogSource("VpcFlow", {
 *   sourceName: "VPC_FLOW",
 *   sourceVersion: "2.0",
 *   regions: ["us-west-2", "us-east-1"],
 *   accounts: ["123456789012"],
 * });
 * ```
 */
const AwsLogSourceResource = Resource("AWS.SecurityLake.AwsLogSource");
export { AwsLogSourceResource as AwsLogSource };
/**
 * Security Lake reported per-account failures when enabling or disabling an
 * AWS log source.
 */
export class AwsLogSourceOperationFailed extends Data.TaggedError("AwsLogSourceOperationFailed") {
}
const failIfPartialFailure = (operation, sourceName, failed) => failed !== undefined && failed.length > 0
    ? Effect.fail(new AwsLogSourceOperationFailed({
        operation,
        sourceName,
        failedAccounts: [...failed],
    }))
    : Effect.void;
export const AwsLogSourceProvider = () => Provider.effect(AwsLogSourceResource, Effect.gen(function* () {
    // Observed state: the set of Regions in which this source (matched by
    // name, and version when pinned) is currently collecting, plus the
    // resolved versions AWS reports.
    const observeSource = Effect.fn(function* (sourceName, sourceVersion) {
        const entries = yield* securitylake.listLogSources
            .items({
            sources: [
                {
                    awsLogSource: {
                        sourceName,
                        ...(sourceVersion !== undefined ? { sourceVersion } : {}),
                    },
                },
            ],
        })
            .pipe(Stream.runCollect);
        const regions = new Set();
        let resolvedVersion;
        for (const entry of entries) {
            const matched = (entry.sources ?? []).find((source) => source.awsLogSource?.sourceName === sourceName &&
                (sourceVersion === undefined ||
                    source.awsLogSource.sourceVersion === sourceVersion));
            if (matched && entry.region !== undefined) {
                regions.add(entry.region);
                resolvedVersion ??= matched.awsLogSource?.sourceVersion;
            }
        }
        return { regions, resolvedVersion };
    });
    const sourceConfig = (sourceName, sourceVersion, regions, accounts) => ({
        sourceName,
        regions,
        ...(sourceVersion !== undefined ? { sourceVersion } : {}),
        ...(accounts !== undefined ? { accounts } : {}),
    });
    return {
        read: Effect.fn(function* ({ olds, output }) {
            const sourceName = output?.sourceName ?? olds?.sourceName;
            if (sourceName === undefined)
                return undefined;
            const sourceVersion = output?.sourceVersion ?? olds?.sourceVersion;
            // An account that never onboarded Security Lake rejects
            // listLogSources — that means "no log source", not a failure.
            const observed = yield* observeSource(sourceName, sourceVersion).pipe(Effect.catchTag([
                "AccessDeniedException",
                "ResourceNotFoundException",
                "UnauthorizedException",
            ], () => Effect.succeed({
                regions: new Set(),
                resolvedVersion: undefined,
            })));
            if (observed.regions.size === 0)
                return undefined;
            // Log sources carry no tags, so ownership can't be distinguished —
            // read reports observed state directly.
            return {
                sourceName,
                sourceVersion: observed.resolvedVersion ?? sourceVersion,
                regions: [...observed.regions].sort(),
                accounts: output?.accounts ?? olds?.accounts,
            };
        }),
        // Enumerate every enabled AWS log source, aggregated by
        // (sourceName, sourceVersion) across Regions.
        list: () => Effect.gen(function* () {
            const entries = yield* securitylake.listLogSources.items({}).pipe(Stream.runCollect, 
            // An account that never onboarded Security Lake has no data
            // lake to list sources for.
            Effect.catchTag([
                "AccessDeniedException",
                "ResourceNotFoundException",
                "UnauthorizedException",
            ], () => Effect.succeed([])));
            const grouped = new Map();
            for (const entry of entries) {
                for (const source of entry.sources ?? []) {
                    const aws = source.awsLogSource;
                    if (aws?.sourceName === undefined || entry.region === undefined)
                        continue;
                    const key = `${aws.sourceName}@${aws.sourceVersion ?? ""}`;
                    const group = grouped.get(key) ?? {
                        sourceName: aws.sourceName,
                        sourceVersion: aws.sourceVersion,
                        regions: new Set(),
                    };
                    group.regions.add(entry.region);
                    grouped.set(key, group);
                }
            }
            return [...grouped.values()].map((group) => ({
                sourceName: group.sourceName,
                sourceVersion: group.sourceVersion,
                regions: [...group.regions].sort(),
                accounts: undefined,
            }));
        }),
        // The source identity (name + pinned version) is create-only — a
        // change tears down collection for the old source and enables the new.
        diff: Effect.fn(function* ({ news, olds }) {
            if (!isResolved(news))
                return undefined;
            if (news.sourceName !== olds.sourceName ||
                news.sourceVersion !== olds.sourceVersion) {
                return { action: "replace" };
            }
        }),
        reconcile: Effect.fn(function* ({ news, output, session }) {
            const desiredRegions = news.regions;
            const previousAccounts = output?.accounts;
            // 1. OBSERVE — which Regions already collect this source.
            const observed = yield* observeSource(news.sourceName, news.sourceVersion);
            // 2. ENSURE — enable collection in Regions where it is missing.
            const missingRegions = desiredRegions.filter((region) => !observed.regions.has(region));
            if (missingRegions.length > 0) {
                const response = yield* securitylake.createAwsLogSource({
                    sources: [
                        sourceConfig(news.sourceName, news.sourceVersion, missingRegions, news.accounts),
                    ],
                });
                yield* failIfPartialFailure("create", news.sourceName, response.failed ? [...response.failed] : undefined);
            }
            // 3. SYNC accounts — enable for newly added accounts everywhere,
            // disable for accounts no longer desired.
            const addedAccounts = (news.accounts ?? []).filter((account) => !(previousAccounts ?? []).includes(account));
            const alreadyEnabledRegions = desiredRegions.filter((region) => observed.regions.has(region));
            if (addedAccounts.length > 0 &&
                previousAccounts !== undefined &&
                alreadyEnabledRegions.length > 0) {
                const response = yield* securitylake.createAwsLogSource({
                    sources: [
                        sourceConfig(news.sourceName, news.sourceVersion, alreadyEnabledRegions, addedAccounts),
                    ],
                });
                yield* failIfPartialFailure("create", news.sourceName, response.failed ? [...response.failed] : undefined);
            }
            const removedAccounts = (previousAccounts ?? []).filter((account) => news.accounts !== undefined && !news.accounts.includes(account));
            if (removedAccounts.length > 0 && desiredRegions.length > 0) {
                const response = yield* securitylake.deleteAwsLogSource({
                    sources: [
                        sourceConfig(news.sourceName, news.sourceVersion, desiredRegions, removedAccounts),
                    ],
                });
                yield* failIfPartialFailure("delete", news.sourceName, response.failed ? [...response.failed] : undefined);
            }
            // 3b. SYNC Region removals — only Regions this resource previously
            // managed (recorded in output) are disabled.
            const staleRegions = (output?.regions ?? []).filter((managed) => !desiredRegions.includes(managed) &&
                observed.regions.has(managed));
            if (staleRegions.length > 0) {
                yield* securitylake.deleteAwsLogSource({
                    sources: [
                        sourceConfig(news.sourceName, news.sourceVersion, staleRegions, previousAccounts ?? news.accounts),
                    ],
                });
            }
            // 4. RETURN fresh attributes.
            const final = yield* observeSource(news.sourceName, news.sourceVersion);
            yield* session.note(news.sourceName);
            return {
                sourceName: news.sourceName,
                sourceVersion: final.resolvedVersion ?? news.sourceVersion,
                regions: final.regions.size > 0
                    ? [...final.regions].sort()
                    : [...desiredRegions].sort(),
                accounts: news.accounts,
            };
        }),
        delete: Effect.fn(function* ({ output }) {
            if (output.regions.length === 0)
                return;
            yield* securitylake
                .deleteAwsLogSource({
                sources: [
                    {
                        sourceName: output.sourceName,
                        regions: output.regions,
                        ...(output.sourceVersion !== undefined
                            ? { sourceVersion: output.sourceVersion }
                            : {}),
                        ...(output.accounts !== undefined
                            ? { accounts: output.accounts }
                            : {}),
                    },
                ],
            })
                .pipe(
            // Gone already, or the data lake itself was offboarded first
            // (which stops all collection and makes log-source APIs reject
            // with UnauthorizedException/AccessDeniedException).
            Effect.catchTag([
                "AccessDeniedException",
                "ResourceNotFoundException",
                "UnauthorizedException",
            ], () => Effect.void));
        }),
    };
}));
//# sourceMappingURL=AwsLogSource.js.map