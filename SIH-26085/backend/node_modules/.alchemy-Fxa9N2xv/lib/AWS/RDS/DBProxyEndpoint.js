import * as rds from "@distilled.cloud/aws/rds";
import * as Effect from "effect/Effect";
import * as Schedule from "effect/Schedule";
import * as Stream from "effect/Stream";
import { isResolved } from "../../Diff.js";
import { createPhysicalName } from "../../PhysicalName.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
import { createInternalTags, diffTags } from "../../Tags.js";
/**
 * An additional RDS Proxy endpoint — a second DNS name on an existing
 * `DBProxy`, typically read-only for reader traffic or placed in a
 * different VPC.
 *
 * Changing the name, owning proxy, subnets, or target role replaces the
 * endpoint; security groups and tags update in place.
 * ### Creating Proxy Endpoints
 * **Example:** Read-Only Endpoint
 * ```typescript
 * const readerEndpoint = yield* DBProxyEndpoint("ReaderEndpoint", {
 *   dbProxyName: proxy.dbProxyName,
 *   vpcSubnetIds: [privateSubnetA.subnetId, privateSubnetB.subnetId],
 *   vpcSecurityGroupIds: [dbSecurityGroup.groupId],
 *   targetRole: "READ_ONLY",
 * });
 * ```
 *
 * @resource
 */
export const DBProxyEndpoint = Resource("AWS.RDS.DBProxyEndpoint");
const toAttrs = ({ endpoint, tags, }) => ({
    dbProxyEndpointName: endpoint.DBProxyEndpointName ?? "",
    dbProxyEndpointArn: endpoint.DBProxyEndpointArn ?? "",
    dbProxyName: endpoint.DBProxyName,
    endpoint: endpoint.Endpoint,
    status: endpoint.Status,
    vpcId: endpoint.VpcId,
    vpcSubnetIds: endpoint.VpcSubnetIds ?? [],
    vpcSecurityGroupIds: endpoint.VpcSecurityGroupIds ?? [],
    targetRole: endpoint.TargetRole,
    tags,
});
export const DBProxyEndpointProvider = () => Provider.effect(DBProxyEndpoint, Effect.gen(function* () {
    const toName = (id, props) => props.dbProxyEndpointName
        ? Effect.succeed(props.dbProxyEndpointName)
        : createPhysicalName({ id, maxLength: 63 });
    const readEndpoint = Effect.fn(function* ({ dbProxyName, dbProxyEndpointName, }) {
        const response = yield* rds
            .describeDBProxyEndpoints({
            DBProxyName: dbProxyName,
            DBProxyEndpointName: dbProxyEndpointName,
        })
            .pipe(Effect.catchTag("DBProxyEndpointNotFoundFault", () => Effect.succeed(undefined)));
        return response?.DBProxyEndpoints?.[0];
    });
    const waitForEndpoint = Effect.fn(function* (props) {
        const readinessPolicy = Schedule.max([
            Schedule.fixed("2 seconds"),
            Schedule.recurs(30),
        ]);
        return yield* readEndpoint(props).pipe(Effect.flatMap((endpoint) => endpoint?.DBProxyEndpointArn
            ? Effect.succeed(endpoint)
            : Effect.fail(new Error(`DB proxy endpoint '${props.dbProxyEndpointName}' not ready`))), Effect.retry({ schedule: readinessPolicy }));
    });
    return {
        stables: ["dbProxyEndpointArn", "dbProxyEndpointName"],
        list: () => Effect.gen(function* () {
            // Endpoints are keyed under a parent proxy. Enumerate every proxy,
            // then fan out `describeDBProxyEndpoints` per proxy (bounded
            // concurrency) and flatten. `describe` does not surface tags
            // inline, so each item hydrates with `tags: {}` — the same shape
            // `read` returns when no prior tags are recorded.
            const proxyNames = yield* rds.describeDBProxies.pages({}).pipe(Stream.runCollect, Effect.map((chunk) => Array.from(chunk).flatMap((page) => (page.DBProxies ?? [])
                .map((proxy) => proxy.DBProxyName)
                .filter((name) => name != null))));
            const rows = yield* Effect.forEach(proxyNames, (dbProxyName) => rds.describeDBProxyEndpoints
                .pages({ DBProxyName: dbProxyName })
                .pipe(Stream.runCollect, Effect.map((chunk) => Array.from(chunk).flatMap((page) => (page.DBProxyEndpoints ?? []).map((endpoint) => toAttrs({ endpoint, tags: {} })))), 
            // A proxy (or its endpoints) may be deleted mid-enumeration.
            Effect.catchTag(["DBProxyNotFoundFault", "DBProxyEndpointNotFoundFault"], () => Effect.succeed([]))), { concurrency: 10 });
            return rows.flat();
        }),
        diff: Effect.fn(function* ({ id, olds, news }) {
            if (!isResolved(news))
                return undefined;
            if ((yield* toName(id, olds ?? {})) !==
                (yield* toName(id, news))) {
                return { action: "replace" };
            }
            if (olds?.dbProxyName !== news.dbProxyName) {
                return { action: "replace" };
            }
        }),
        read: Effect.fn(function* ({ id, olds, output }) {
            const dbProxyEndpointName = output?.dbProxyEndpointName ??
                (yield* toName(id, olds ??
                    {
                        dbProxyName: "",
                        vpcSubnetIds: [],
                    }));
            const endpoint = yield* readEndpoint({
                dbProxyName: output?.dbProxyName ?? olds?.dbProxyName ?? "",
                dbProxyEndpointName,
            });
            if (!endpoint?.DBProxyEndpointArn) {
                return undefined;
            }
            return toAttrs({ endpoint, tags: output?.tags ?? {} });
        }),
        reconcile: Effect.fn(function* ({ id, news, output, session }) {
            const dbProxyEndpointName = output?.dbProxyEndpointName ?? (yield* toName(id, news));
            const internalTags = yield* createInternalTags(id);
            const desiredTags = { ...internalTags, ...news.tags };
            // Observe — fetch live endpoint state.
            let observed = yield* readEndpoint({
                dbProxyName: output?.dbProxyName ?? news.dbProxyName,
                dbProxyEndpointName,
            });
            // Ensure — create if missing. Tolerate
            // `DBProxyEndpointAlreadyExistsFault` as a race with a peer
            // reconciler.
            if (!observed?.DBProxyEndpointArn) {
                yield* rds
                    .createDBProxyEndpoint({
                    DBProxyName: news.dbProxyName,
                    DBProxyEndpointName: dbProxyEndpointName,
                    VpcSubnetIds: news.vpcSubnetIds,
                    VpcSecurityGroupIds: news.vpcSecurityGroupIds,
                    TargetRole: news.targetRole,
                    EndpointNetworkType: news.endpointNetworkType,
                    Tags: Object.entries(desiredTags).map(([Key, Value]) => ({
                        Key,
                        Value,
                    })),
                })
                    .pipe(Effect.catchTag("DBProxyEndpointAlreadyExistsFault", () => Effect.void));
                observed = yield* waitForEndpoint({
                    dbProxyName: news.dbProxyName,
                    dbProxyEndpointName,
                });
            }
            else {
                // Sync mutable endpoint config — security groups + rename. The
                // rename argument is a no-op when desired matches observed.
                yield* rds.modifyDBProxyEndpoint({
                    DBProxyEndpointName: dbProxyEndpointName,
                    VpcSecurityGroupIds: news.vpcSecurityGroupIds,
                    NewDBProxyEndpointName: news.dbProxyEndpointName &&
                        news.dbProxyEndpointName !== dbProxyEndpointName
                        ? news.dbProxyEndpointName
                        : undefined,
                });
                observed = yield* waitForEndpoint({
                    dbProxyName: observed.DBProxyName ?? news.dbProxyName,
                    dbProxyEndpointName: news.dbProxyEndpointName &&
                        news.dbProxyEndpointName !== dbProxyEndpointName
                        ? news.dbProxyEndpointName
                        : dbProxyEndpointName,
                });
            }
            const dbProxyEndpointArn = observed.DBProxyEndpointArn ?? "";
            // Sync tags — diff prior recorded tags against desired (describe
            // does not surface tags inline).
            const observedTags = output?.tags ?? {};
            const { removed, upsert } = diffTags(observedTags, desiredTags);
            if (upsert.length > 0 && dbProxyEndpointArn) {
                yield* rds.addTagsToResource({
                    ResourceName: dbProxyEndpointArn,
                    Tags: upsert,
                });
            }
            if (removed.length > 0 && dbProxyEndpointArn) {
                yield* rds.removeTagsFromResource({
                    ResourceName: dbProxyEndpointArn,
                    TagKeys: removed,
                });
            }
            yield* session.note(dbProxyEndpointArn || dbProxyEndpointName);
            return toAttrs({ endpoint: observed, tags: desiredTags });
        }),
        delete: Effect.fn(function* ({ output }) {
            yield* rds
                .deleteDBProxyEndpoint({
                DBProxyEndpointName: output.dbProxyEndpointName,
            })
                .pipe(Effect.catchTag("DBProxyEndpointNotFoundFault", () => Effect.void));
        }),
    };
}));
//# sourceMappingURL=DBProxyEndpoint.js.map