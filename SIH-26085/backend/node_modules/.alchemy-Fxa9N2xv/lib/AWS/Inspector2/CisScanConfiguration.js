import * as inspector2 from "@distilled.cloud/aws/inspector2";
import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";
import { Unowned } from "../../AdoptPolicy.js";
import { createPhysicalName } from "../../PhysicalName.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
import { createInternalTags, diffTags, hasAlchemyTags, tagRecord, } from "../../Tags.js";
/**
 * An Amazon Inspector CIS scan configuration — schedules CIS Benchmark
 * scans of SSM-managed EC2 instances selected by resource tags. Name,
 * level, schedule, and targets are all updatable in place; identity is the
 * configuration's ARN.
 *
 * ### Scheduling CIS Scans
 * **Example:** Daily Level 1 scan of production instances
 * ```typescript
 * const scan = yield* AWS.Inspector2.CisScanConfiguration("NightlyCis", {
 *   securityLevel: "LEVEL_1",
 *   schedule: {
 *     daily: { startTime: { timeOfDay: "02:00", timezone: "UTC" } },
 *   },
 *   targets: {
 *     accountIds: ["SELF"],
 *     targetResourceTags: { Environment: ["production"] },
 *   },
 * });
 * ```
 *
 * **Example:** One-time Level 2 audit
 * ```typescript
 * const audit = yield* AWS.Inspector2.CisScanConfiguration("Level2Audit", {
 *   scanName: "level2-audit",
 *   securityLevel: "LEVEL_2",
 *   schedule: { oneTime: {} },
 *   targets: {
 *     accountIds: ["SELF"],
 *     targetResourceTags: { Audit: ["true"] },
 *   },
 * });
 * ```
 */
const CisScanConfigurationResource = Resource("AWS.Inspector2.CisScanConfiguration");
export { CisScanConfigurationResource as CisScanConfiguration };
export const CisScanConfigurationProvider = () => Provider.effect(CisScanConfigurationResource, Effect.gen(function* () {
    const toName = (id, props) => props.scanName
        ? Effect.succeed(props.scanName)
        : createPhysicalName({ id, maxLength: 128 });
    const findBy = (filter) => inspector2
        .listCisScanConfigurations({ filterCriteria: filter })
        .pipe(Effect.map((r) => r.scanConfigurations?.[0]));
    const findByArn = (arn) => findBy({
        scanConfigurationArnFilters: [{ comparison: "EQUALS", value: arn }],
    });
    const findByName = (name) => findBy({ scanNameFilters: [{ comparison: "EQUALS", value: name }] });
    const buildAttrs = (c) => ({
        scanConfigurationArn: c.scanConfigurationArn,
        scanName: c.scanName ?? "",
        securityLevel: c.securityLevel,
        ownerId: c.ownerId,
    });
    return {
        stables: ["scanConfigurationArn", "ownerId"],
        read: Effect.fn(function* ({ id, olds, output }) {
            const live = output?.scanConfigurationArn
                ? yield* findByArn(output.scanConfigurationArn)
                : yield* findByName(yield* toName(id, olds ?? {}));
            if (!live)
                return undefined;
            const attrs = buildAttrs(live);
            return (yield* hasAlchemyTags(id, live.tags))
                ? attrs
                : Unowned(attrs);
        }),
        list: () => inspector2.listCisScanConfigurations
            .items({})
            .pipe(Stream.map(buildAttrs), Stream.runCollect)
            .pipe(Effect.map((c) => Array.from(c))),
        reconcile: Effect.fn(function* ({ id, news, output, session }) {
            const scanName = yield* toName(id, news);
            const internalTags = yield* createInternalTags(id);
            const desiredTags = { ...news.tags, ...internalTags };
            // 1. OBSERVE — cloud state is authoritative. The ARN survives
            // renames; fall back to a name lookup otherwise.
            let live = output?.scanConfigurationArn
                ? yield* findByArn(output.scanConfigurationArn)
                : yield* findByName(scanName);
            // 2. ENSURE — create when missing.
            if (!live) {
                const { scanConfigurationArn } = yield* inspector2.createCisScanConfiguration({
                    scanName,
                    securityLevel: news.securityLevel,
                    schedule: news.schedule,
                    targets: news.targets,
                    tags: desiredTags,
                });
                live = scanConfigurationArn
                    ? yield* findByArn(scanConfigurationArn)
                    : yield* findByName(scanName);
                if (!live) {
                    return yield* Effect.die(new Error(`Inspector2 CIS scan configuration ${scanName} not visible after create`));
                }
            }
            // 3. SYNC settings — observed ↔ desired.
            const drift = live.scanName !== scanName ||
                live.securityLevel !== news.securityLevel ||
                JSON.stringify(live.schedule) !== JSON.stringify(news.schedule) ||
                JSON.stringify(live.targets?.accountIds) !==
                    JSON.stringify(news.targets.accountIds) ||
                JSON.stringify(live.targets?.targetResourceTags) !==
                    JSON.stringify(news.targets.targetResourceTags);
            if (drift) {
                yield* inspector2.updateCisScanConfiguration({
                    scanConfigurationArn: live.scanConfigurationArn,
                    scanName,
                    securityLevel: news.securityLevel,
                    schedule: news.schedule,
                    targets: news.targets,
                });
            }
            // 3b. SYNC tags — diff against OBSERVED cloud tags so adoption
            // converges foreign tags too.
            const { upsert, removed } = diffTags(tagRecord(live.tags), desiredTags);
            if (upsert.length > 0) {
                yield* inspector2.tagResource({
                    resourceArn: live.scanConfigurationArn,
                    tags: Object.fromEntries(upsert.map((t) => [t.Key, t.Value])),
                });
            }
            if (removed.length > 0) {
                yield* inspector2.untagResource({
                    resourceArn: live.scanConfigurationArn,
                    tagKeys: removed,
                });
            }
            // 4. RETURN fresh attributes.
            const final = yield* findByArn(live.scanConfigurationArn);
            yield* session.note(live.scanConfigurationArn);
            return buildAttrs(final ?? live);
        }),
        delete: Effect.fn(function* ({ output }) {
            // Idempotent — the configuration may already be gone.
            yield* inspector2
                .deleteCisScanConfiguration({
                scanConfigurationArn: output.scanConfigurationArn,
            })
                .pipe(Effect.catchTag("ResourceNotFoundException", () => Effect.void));
        }),
    };
}));
//# sourceMappingURL=CisScanConfiguration.js.map