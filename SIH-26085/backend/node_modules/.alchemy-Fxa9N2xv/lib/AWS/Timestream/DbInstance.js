import * as influxdb from "@distilled.cloud/aws/timestream-influxdb";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Redacted from "effect/Redacted";
import * as EffectStream from "effect/Stream";
import * as Schedule from "effect/Schedule";
import { Unowned } from "../../AdoptPolicy.js";
import { isResolved } from "../../Diff.js";
import { createPhysicalName } from "../../PhysicalName.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
import { createInternalTags, diffTags, hasAlchemyTags, } from "../../Tags.js";
/**
 * An Amazon Timestream for InfluxDB DB instance — a managed, single-tenant
 * InfluxDB engine for time-series workloads.
 *
 * `DbInstance` owns the instance's lifecycle and its mutable configuration
 * (instance type, storage, port, parameter group, log delivery, deployment
 * type, and tags). Networking (subnets, security groups), the initial
 * credentials, organization, and bucket are fixed at creation.
 *
 * :::caution
 * Provisioning a DB instance takes ~15–20 minutes and incurs EC2-backed cost.
 * :::
 * ### Creating DB Instances
 * **Example:** Basic InfluxDB Instance
 * ```typescript
 * import * as Timestream from "alchemy/AWS/Timestream";
 *
 * const influx = yield* Timestream.DbInstance("Influx", {
 *   name: "my-influx",
 *   dbInstanceType: "db.influx.medium",
 *   allocatedStorage: 20,
 *   vpcSubnetIds: [subnetA.subnetId, subnetB.subnetId],
 *   vpcSecurityGroupIds: [securityGroup.groupId],
 *   password: Redacted.make("super-secret-password"),
 * });
 * ```
 *
 * @resource
 */
export const DbInstance = Resource("AWS.Timestream.DbInstance");
const createInstanceName = (id, props) => Effect.gen(function* () {
    if (props.name) {
        return props.name;
    }
    return yield* createPhysicalName({ id, maxLength: 40 });
});
const toAttrs = (instance, tags) => ({
    id: instance.id,
    name: instance.name,
    arn: instance.arn,
    status: instance.status,
    endpoint: instance.endpoint,
    port: instance.port,
    influxAuthParametersSecretArn: instance.influxAuthParametersSecretArn,
    dbInstanceType: instance.dbInstanceType,
    allocatedStorage: instance.allocatedStorage,
    vpcSubnetIds: instance.vpcSubnetIds,
    tags,
});
const fetchTags = Effect.fn(function* (arn) {
    const response = yield* influxdb
        .listTagsForResource({ resourceArn: arn })
        .pipe(Effect.catchTag("ResourceNotFoundException", () => Effect.succeed(undefined)));
    const tags = response?.tags ?? {};
    return Object.fromEntries(Object.entries(tags).filter((entry) => typeof entry[1] === "string"));
});
const readInstanceById = Effect.fn(function* (identifier) {
    const instance = yield* influxdb
        .getDbInstance({ identifier })
        .pipe(Effect.catchTag("ResourceNotFoundException", () => Effect.succeed(undefined)));
    if (!instance)
        return undefined;
    return toAttrs(instance, yield* fetchTags(instance.arn));
});
const findInstanceByName = Effect.fn(function* (name) {
    const summaries = yield* influxdb.listDbInstances.pages({}).pipe(EffectStream.runCollect, Effect.map((chunk) => Array.from(chunk).flatMap((page) => page.items ?? [])));
    const match = summaries.find((summary) => summary.name === name);
    if (!match)
        return undefined;
    return yield* readInstanceById(match.id);
});
/**
 * A DB instance still transitioning toward the awaited status — retried by
 * {@link waitForStatus}'s bounded schedule.
 */
class DbInstanceNotReady extends Data.TaggedError("DbInstanceNotReady") {
}
/**
 * A DB instance whose asynchronous provisioning converged to a terminal
 * failure status (`FAILED` / `REBOOT_FAILED`).
 */
export class DbInstanceProvisioningFailed extends Data.TaggedError("DbInstanceProvisioningFailed") {
}
// Explicitly-typed retry wrapper — an inline `Effect.retry` in provider
// lifecycle code leaks `Retry.Return`'s conditional type into declaration
// emit and widens the provider layer to `unknown` for every consumer of
// `AWS.providers()`.
const retryWhileNotReady = (self) => Effect.retry(self, {
    // ParseError: a CREATING instance can transiently decode incompletely
    // while fields are still being populated — treat it as not-ready.
    while: (e) => e._tag === "DbInstanceNotReady" || e._tag === "ParseError",
    // Provisioning is slow (~15–20 min); poll every 20s up to ~30 min.
    schedule: Schedule.max([
        Schedule.spaced("20 seconds"),
        Schedule.recurs(90),
    ]),
});
const waitForStatus = (identifier, target) => retryWhileNotReady(Effect.gen(function* () {
    const instance = yield* influxdb
        .getDbInstance({ identifier })
        .pipe(Effect.catchTag("ResourceNotFoundException", () => Effect.succeed(undefined)));
    if (target === "DELETED") {
        if (instance === undefined)
            return;
        return yield* Effect.fail(new DbInstanceNotReady({ identifier, status: instance.status }));
    }
    if (instance?.status === "AVAILABLE")
        return;
    if (instance?.status === "FAILED" ||
        instance?.status === "REBOOT_FAILED") {
        return yield* Effect.fail(new DbInstanceProvisioningFailed({
            identifier,
            status: instance.status,
        }));
    }
    return yield* Effect.fail(new DbInstanceNotReady({ identifier, status: instance?.status }));
}));
export const DbInstanceProvider = () => Provider.effect(DbInstance, Effect.gen(function* () {
    return {
        stables: ["id", "arn", "name"],
        list: () => Effect.gen(function* () {
            const summaries = yield* influxdb.listDbInstances.pages({}).pipe(EffectStream.runCollect, Effect.map((chunk) => Array.from(chunk).flatMap((page) => page.items ?? [])));
            const hydrated = yield* Effect.forEach(summaries, (summary) => readInstanceById(summary.id), { concurrency: 5 });
            return hydrated.filter((attrs) => attrs !== undefined);
        }),
        read: Effect.fn(function* ({ id, olds, output }) {
            const state = output?.id
                ? yield* readInstanceById(output.id)
                : yield* findInstanceByName(yield* createInstanceName(id, olds ?? {}));
            if (!state)
                return undefined;
            return (yield* hasAlchemyTags(id, state.tags))
                ? state
                : Unowned(state);
        }),
        diff: Effect.fn(function* ({ id, news, olds = {} }) {
            if (!isResolved(news))
                return;
            const oldName = yield* createInstanceName(id, olds);
            const newName = yield* createInstanceName(id, news);
            // Name and the networking/credential aspects are immutable — changing
            // any of them requires a replacement.
            const arraysDiffer = (a, b) => JSON.stringify([...(a ?? [])].sort()) !==
                JSON.stringify([...(b ?? [])].sort());
            if (oldName !== newName ||
                arraysDiffer(olds.vpcSubnetIds, news.vpcSubnetIds) ||
                arraysDiffer(olds.vpcSecurityGroupIds, news.vpcSecurityGroupIds) ||
                olds.username !== news.username ||
                olds.organization !== news.organization ||
                olds.bucket !== news.bucket ||
                olds.publiclyAccessible !== news.publiclyAccessible ||
                olds.networkType !== news.networkType) {
                return { action: "replace" };
            }
        }),
        reconcile: Effect.fn(function* ({ id, news, output, session }) {
            if (!news) {
                return yield* Effect.fail(new Error("Timestream DbInstance requires props"));
            }
            const name = output?.name ?? (yield* createInstanceName(id, news));
            const internalTags = yield* createInternalTags(id);
            const desiredTags = { ...internalTags, ...news.tags };
            // Observe — prefer the cached id; fall back to a name lookup so a
            // create whose state failed to persist is adopted rather than
            // duplicated.
            let state = output?.id
                ? yield* readInstanceById(output.id)
                : yield* findInstanceByName(name);
            // Ensure — create if missing, then wait for AVAILABLE.
            if (state === undefined) {
                const created = yield* influxdb.createDbInstance({
                    name,
                    dbInstanceType: news.dbInstanceType,
                    allocatedStorage: news.allocatedStorage,
                    vpcSubnetIds: news.vpcSubnetIds,
                    vpcSecurityGroupIds: news.vpcSecurityGroupIds,
                    password: Redacted.value(news.password),
                    username: news.username,
                    organization: news.organization,
                    bucket: news.bucket,
                    dbStorageType: news.dbStorageType,
                    publiclyAccessible: news.publiclyAccessible,
                    deploymentType: news.deploymentType,
                    dbParameterGroupIdentifier: news.dbParameterGroupIdentifier,
                    logDeliveryConfiguration: news.logDeliveryConfiguration,
                    port: news.port,
                    networkType: news.networkType,
                    tags: desiredTags,
                });
                yield* session.note(`Creating DB instance ${name} (${created.id})...`);
                yield* waitForStatus(created.id, "AVAILABLE");
                state = yield* readInstanceById(created.id);
                if (state === undefined) {
                    return yield* Effect.fail(new Error(`failed to read created DB instance ${name}`));
                }
            }
            // Sync mutable settings via UpdateDbInstance. It is a partial upsert;
            // only send it when a mutable aspect drifted from observed state.
            const needsUpdate = (news.dbInstanceType !== undefined &&
                news.dbInstanceType !== state.dbInstanceType) ||
                (news.allocatedStorage !== undefined &&
                    news.allocatedStorage !== state.allocatedStorage) ||
                (news.port !== undefined && news.port !== state.port) ||
                news.dbParameterGroupIdentifier !== undefined ||
                news.logDeliveryConfiguration !== undefined ||
                news.deploymentType !== undefined ||
                news.dbStorageType !== undefined;
            if (needsUpdate) {
                yield* influxdb.updateDbInstance({
                    identifier: state.id,
                    dbInstanceType: news.dbInstanceType,
                    allocatedStorage: news.allocatedStorage,
                    port: news.port,
                    dbParameterGroupIdentifier: news.dbParameterGroupIdentifier,
                    logDeliveryConfiguration: news.logDeliveryConfiguration,
                    deploymentType: news.deploymentType,
                    dbStorageType: news.dbStorageType,
                });
                yield* waitForStatus(state.id, "AVAILABLE");
                yield* session.note(`Updated DB instance ${name}`);
            }
            // Sync tags — diff against observed cloud tags.
            const { removed, upsert } = diffTags(state.tags, desiredTags);
            if (removed.length > 0) {
                yield* influxdb.untagResource({
                    resourceArn: state.arn,
                    tagKeys: removed,
                });
            }
            if (upsert.length > 0) {
                yield* influxdb.tagResource({
                    resourceArn: state.arn,
                    tags: Object.fromEntries(upsert.map(({ Key, Value }) => [Key, Value])),
                });
            }
            yield* session.note(state.arn);
            const final = yield* readInstanceById(state.id);
            if (!final) {
                return yield* Effect.fail(new Error(`failed to read reconciled DB instance ${name}`));
            }
            return final;
        }),
        delete: Effect.fn(function* ({ output }) {
            yield* influxdb
                .deleteDbInstance({ identifier: output.id })
                .pipe(Effect.catchTag("ResourceNotFoundException", () => Effect.void));
            yield* waitForStatus(output.id, "DELETED");
        }),
    };
}));
//# sourceMappingURL=DbInstance.js.map