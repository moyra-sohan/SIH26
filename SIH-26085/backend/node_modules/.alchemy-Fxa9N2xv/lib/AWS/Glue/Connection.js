import * as glue from "@distilled.cloud/aws/glue";
import * as Effect from "effect/Effect";
import * as Redacted from "effect/Redacted";
import * as Stream from "effect/Stream";
import { Unowned } from "../../AdoptPolicy.js";
import { isResolved } from "../../Diff.js";
import { createPhysicalName } from "../../PhysicalName.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
import { createInternalTags, hasAlchemyTags } from "../../Tags.js";
import { AWSEnvironment } from "../Environment.js";
import { connectionArn, fetchObservedTags, syncTags } from "./internal.js";
/**
 * An AWS Glue connection — stores the connection details (JDBC URL, VPC
 * networking, credentials) that crawlers and jobs use to reach a data store.
 * ### Creating Connections
 * **Example:** JDBC Connection
 * ```typescript
 * import * as AWS from "alchemy/AWS";
 * import * as Redacted from "effect/Redacted";
 *
 * const connection = yield* AWS.Glue.Connection("Warehouse", {
 *   connectionType: "JDBC",
 *   connectionProperties: {
 *     JDBC_CONNECTION_URL: "jdbc:postgresql://db.example.com:5432/warehouse",
 *     USERNAME: "glue",
 *     PASSWORD: Redacted.make("secret"),
 *   },
 *   physicalConnectionRequirements: {
 *     subnetId: subnet.subnetId,
 *     securityGroupIdList: [securityGroup.groupId],
 *     availabilityZone: "us-west-2a",
 *   },
 * });
 * ```
 *
 * @resource
 */
export const Connection = Resource("AWS.Glue.Connection");
export const ConnectionProvider = () => Provider.effect(Connection, Effect.gen(function* () {
    const createName = Effect.fn(function* (id, props) {
        return (props.connectionName ??
            (yield* createPhysicalName({ id, maxLength: 255 })));
    });
    const observe = Effect.fn(function* (name, catalogId) {
        return yield* glue
            .getConnection({
            Name: name,
            CatalogId: catalogId,
            HidePassword: true,
        })
            .pipe(Effect.map((r) => r.Connection), Effect.catchTag("EntityNotFoundException", () => Effect.succeed(undefined)));
    });
    const buildInput = (name, props) => ({
        Name: name,
        ConnectionType: props.connectionType,
        Description: props.description,
        ConnectionProperties: Object.fromEntries(Object.entries(props.connectionProperties).map(([key, value]) => [
            key,
            Redacted.isRedacted(value) ? Redacted.value(value) : value,
        ])),
        MatchCriteria: props.matchCriteria,
        PhysicalConnectionRequirements: props.physicalConnectionRequirements
            ? {
                SubnetId: props.physicalConnectionRequirements.subnetId,
                SecurityGroupIdList: props.physicalConnectionRequirements.securityGroupIdList,
                AvailabilityZone: props.physicalConnectionRequirements.availabilityZone,
            }
            : undefined,
    });
    return Connection.Provider.of({
        stables: ["connectionName", "connectionArn", "catalogId"],
        list: () => Effect.gen(function* () {
            const { accountId, region } = yield* AWSEnvironment.current;
            const pages = yield* glue.getConnections
                .pages({})
                .pipe(Stream.runCollect);
            return Array.from(pages)
                .flatMap((page) => page.ConnectionList ?? [])
                .filter((c) => c.Name !== undefined)
                .map((c) => ({
                connectionName: c.Name,
                connectionArn: connectionArn(region, accountId, c.Name),
                connectionType: c.ConnectionType ?? "",
                catalogId: accountId,
            }));
        }),
        read: Effect.fn(function* ({ id, olds, output }) {
            const { accountId, region } = yield* AWSEnvironment.current;
            const catalogId = output?.catalogId ?? olds?.catalogId ?? accountId;
            const name = output?.connectionName ?? (yield* createName(id, olds ?? {}));
            const connection = yield* observe(name, catalogId);
            if (connection?.Name === undefined)
                return undefined;
            const arn = connectionArn(region, accountId, connection.Name);
            const attrs = {
                connectionName: connection.Name,
                connectionArn: arn,
                connectionType: connection.ConnectionType ?? "",
                catalogId,
            };
            const tags = yield* fetchObservedTags(arn);
            return (yield* hasAlchemyTags(id, tags)) ? attrs : Unowned(attrs);
        }),
        diff: Effect.fn(function* ({ id, news, olds }) {
            if (!isResolved(news))
                return undefined;
            const oldName = yield* createName(id, olds);
            const newName = yield* createName(id, news);
            if (oldName !== newName)
                return { action: "replace" };
            if ((olds.catalogId ?? undefined) !== (news.catalogId ?? undefined)) {
                return { action: "replace" };
            }
            // type / properties / networking / description → update
        }),
        reconcile: Effect.fn(function* ({ id, news, output, session }) {
            const { accountId, region } = yield* AWSEnvironment.current;
            const catalogId = news.catalogId ?? output?.catalogId ?? accountId;
            const name = output?.connectionName ?? (yield* createName(id, news));
            const internalTags = yield* createInternalTags(id);
            const desiredTags = { ...news.tags, ...internalTags };
            const arn = connectionArn(region, accountId, name);
            const input = buildInput(name, news);
            // 1. OBSERVE
            const existing = yield* observe(name, catalogId);
            // 2. ENSURE / 3. SYNC
            if (existing === undefined) {
                yield* glue
                    .createConnection({
                    CatalogId: catalogId,
                    ConnectionInput: input,
                    Tags: desiredTags,
                })
                    .pipe(Effect.catchTag("AlreadyExistsException", () => Effect.void));
            }
            else {
                yield* glue.updateConnection({
                    CatalogId: catalogId,
                    Name: name,
                    ConnectionInput: input,
                });
            }
            // 3b. SYNC TAGS
            const observedTags = yield* fetchObservedTags(arn);
            yield* syncTags(arn, observedTags, desiredTags);
            yield* session.note(name);
            return {
                connectionName: name,
                connectionArn: arn,
                connectionType: news.connectionType,
                catalogId,
            };
        }),
        delete: Effect.fn(function* ({ output }) {
            yield* glue
                .deleteConnection({
                ConnectionName: output.connectionName,
                CatalogId: output.catalogId,
            })
                .pipe(Effect.catchTag("EntityNotFoundException", () => Effect.void));
        }),
    });
}));
//# sourceMappingURL=Connection.js.map