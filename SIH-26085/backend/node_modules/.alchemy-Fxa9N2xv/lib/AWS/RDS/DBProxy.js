import * as rds from "@distilled.cloud/aws/rds";
import * as Effect from "effect/Effect";
import * as Schedule from "effect/Schedule";
import * as Stream from "effect/Stream";
import { isResolved } from "../../Diff.js";
import { toWireSeconds } from "../../Util/Duration.js";
import { createPhysicalName } from "../../PhysicalName.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
import { createInternalTags, diffTags } from "../../Tags.js";
/**
 * An RDS Proxy for pooled Lambda-to-Aurora connectivity.
 *
 * The proxy multiplexes many short-lived function connections over a small
 * pool of database connections, absorbing connection storms from Lambda
 * scale-out. It authenticates against the database with credentials read
 * from Secrets Manager via the provided IAM role, then registers targets
 * through a `DBProxyTargetGroup`. Changing the name, engine family, or
 * subnets replaces the proxy; auth, TLS, timeout, and security groups
 * update in place.
 *
 * For the common case, `Aurora("Db", { proxy: true })` wires the role,
 * proxy, target group, and secret automatically.
 * ### Creating a Proxy
 * **Example:** Proxy in Front of an Aurora Cluster
 * ```typescript
 * const proxy = yield* DBProxy("Proxy", {
 *   engineFamily: "POSTGRESQL",
 *   auth: [
 *     {
 *       AuthScheme: "SECRETS",
 *       SecretArn: secret.secretArn,
 *       IAMAuth: "DISABLED",
 *     },
 *   ],
 *   roleArn: proxyRole.roleArn,
 *   vpcSubnetIds: [privateSubnetA.subnetId, privateSubnetB.subnetId],
 *   vpcSecurityGroupIds: [dbSecurityGroup.groupId],
 *   requireTLS: true,
 * });
 *
 * // register the cluster behind the proxy
 * const targets = yield* DBProxyTargetGroup("ProxyTargets", {
 *   dbProxyName: proxy.dbProxyName,
 *   dbClusterIdentifiers: [cluster.dbClusterIdentifier],
 * });
 * ```
 *
 * @resource
 */
export const DBProxy = Resource("AWS.RDS.DBProxy");
const toAttrs = ({ proxy, tags, }) => ({
    dbProxyName: proxy.DBProxyName ?? "",
    dbProxyArn: proxy.DBProxyArn ?? "",
    endpoint: proxy.Endpoint,
    status: proxy.Status,
    engineFamily: proxy.EngineFamily,
    roleArn: proxy.RoleArn,
    vpcId: proxy.VpcId,
    vpcSubnetIds: proxy.VpcSubnetIds ?? [],
    vpcSecurityGroupIds: proxy.VpcSecurityGroupIds ?? [],
    requireTLS: proxy.RequireTLS,
    idleClientTimeout: proxy.IdleClientTimeout,
    debugLogging: proxy.DebugLogging,
    tags,
});
export const DBProxyProvider = () => Provider.effect(DBProxy, Effect.gen(function* () {
    const toName = (id, props) => props.dbProxyName
        ? Effect.succeed(props.dbProxyName)
        : createPhysicalName({ id, maxLength: 63 });
    const readProxy = Effect.fn(function* (name) {
        const response = yield* rds
            .describeDBProxies({
            DBProxyName: name,
        })
            .pipe(Effect.catchTag("DBProxyNotFoundFault", () => Effect.succeed(undefined)));
        return response?.DBProxies?.[0];
    });
    const waitForProxy = Effect.fn(function* (name) {
        const readinessPolicy = Schedule.max([
            Schedule.fixed("2 seconds"),
            Schedule.recurs(30),
        ]);
        return yield* readProxy(name).pipe(Effect.flatMap((proxy) => proxy?.DBProxyArn
            ? Effect.succeed(proxy)
            : Effect.fail(new Error(`DB proxy '${name}' not ready`))), Effect.retry({ schedule: readinessPolicy }));
    });
    return {
        stables: ["dbProxyArn", "dbProxyName"],
        // Enumerate every DB proxy in the account/region via the paginated
        // `describeDBProxies`, then hydrate each proxy's tags via
        // `listTagsForResource` (describe does not return tags inline) so each
        // element matches `read`'s `Attributes` shape exactly. A proxy deleted
        // between the describe and the tag fetch surfaces `DBProxyNotFoundFault`
        // per item and is dropped.
        list: () => Effect.gen(function* () {
            const proxies = yield* rds.describeDBProxies.pages({}).pipe(Stream.runCollect, Effect.map((chunk) => Array.from(chunk).flatMap((page) => page.DBProxies ?? [])));
            const rows = yield* Effect.forEach(proxies, (proxy) => Effect.gen(function* () {
                if (!proxy.DBProxyArn)
                    return undefined;
                const tagResponse = yield* rds
                    .listTagsForResource({ ResourceName: proxy.DBProxyArn })
                    .pipe(Effect.catchTag("DBProxyNotFoundFault", () => Effect.succeed(undefined)));
                if (tagResponse === undefined)
                    return undefined;
                const tags = Object.fromEntries((tagResponse.TagList ?? [])
                    .filter((tag) => tag.Key != null)
                    .map((tag) => [tag.Key, tag.Value ?? ""]));
                return toAttrs({ proxy, tags });
            }), { concurrency: 10 });
            return rows.filter((row) => row !== undefined);
        }),
        diff: Effect.fn(function* ({ id, olds, news }) {
            if (!isResolved(news))
                return undefined;
            if ((yield* toName(id, olds ?? {})) !==
                (yield* toName(id, news))) {
                return { action: "replace" };
            }
            if (olds?.engineFamily !== news.engineFamily) {
                return { action: "replace" };
            }
        }),
        read: Effect.fn(function* ({ id, olds, output }) {
            const name = output?.dbProxyName ??
                (yield* toName(id, olds ??
                    {
                        engineFamily: "POSTGRESQL",
                        auth: [],
                        roleArn: "",
                        vpcSubnetIds: [],
                    }));
            const proxy = yield* readProxy(name);
            if (!proxy?.DBProxyArn) {
                return undefined;
            }
            return toAttrs({ proxy, tags: output?.tags ?? {} });
        }),
        reconcile: Effect.fn(function* ({ id, news, output, session }) {
            const name = output?.dbProxyName ?? (yield* toName(id, news));
            const internalTags = yield* createInternalTags(id);
            const desiredTags = { ...internalTags, ...news.tags };
            // Duration prop → the wire unit the RDS API expects (whole seconds).
            const idleClientTimeoutSeconds = toWireSeconds(news.idleClientTimeout);
            // Observe — fetch live proxy state.
            let observed = yield* readProxy(name);
            // Ensure — create if missing. Tolerate
            // `DBProxyAlreadyExistsFault` as a race with a peer reconciler.
            if (!observed?.DBProxyArn) {
                yield* rds
                    .createDBProxy({
                    DBProxyName: name,
                    EngineFamily: news.engineFamily,
                    Auth: news.auth,
                    RoleArn: news.roleArn,
                    VpcSubnetIds: news.vpcSubnetIds,
                    VpcSecurityGroupIds: news.vpcSecurityGroupIds,
                    RequireTLS: news.requireTLS,
                    IdleClientTimeout: idleClientTimeoutSeconds,
                    DebugLogging: news.debugLogging,
                    EndpointNetworkType: news.endpointNetworkType,
                    TargetConnectionNetworkType: news.targetConnectionNetworkType,
                    Tags: Object.entries(desiredTags).map(([Key, Value]) => ({
                        Key,
                        Value,
                    })),
                })
                    .pipe(Effect.catchTag("DBProxyAlreadyExistsFault", () => Effect.void));
                observed = yield* waitForProxy(name);
            }
            else {
                // Sync mutable proxy config — push desired shape via
                // `modifyDBProxy`. Rename via `NewDBProxyName` is a no-op when
                // the desired name already matches the observed name.
                yield* rds.modifyDBProxy({
                    DBProxyName: name,
                    Auth: news.auth,
                    RoleArn: news.roleArn,
                    SecurityGroups: news.vpcSecurityGroupIds,
                    RequireTLS: news.requireTLS,
                    IdleClientTimeout: idleClientTimeoutSeconds,
                    DebugLogging: news.debugLogging,
                    NewDBProxyName: news.dbProxyName && news.dbProxyName !== name
                        ? news.dbProxyName
                        : undefined,
                });
                observed = yield* waitForProxy(news.dbProxyName ?? name);
            }
            const dbProxyArn = observed.DBProxyArn ?? "";
            const finalName = observed.DBProxyName ?? name;
            // Sync tags — diff prior recorded tags against desired (describe
            // does not surface tags inline).
            const observedTags = output?.tags ?? {};
            const { removed, upsert } = diffTags(observedTags, desiredTags);
            if (upsert.length > 0 && dbProxyArn) {
                yield* rds.addTagsToResource({
                    ResourceName: dbProxyArn,
                    Tags: upsert,
                });
            }
            if (removed.length > 0 && dbProxyArn) {
                yield* rds.removeTagsFromResource({
                    ResourceName: dbProxyArn,
                    TagKeys: removed,
                });
            }
            yield* session.note(dbProxyArn || finalName);
            return toAttrs({ proxy: observed, tags: desiredTags });
        }),
        delete: Effect.fn(function* ({ output }) {
            yield* rds
                .deleteDBProxy({
                DBProxyName: output.dbProxyName,
            })
                .pipe(Effect.catchTag("DBProxyNotFoundFault", () => Effect.void));
        }),
    };
}));
//# sourceMappingURL=DBProxy.js.map