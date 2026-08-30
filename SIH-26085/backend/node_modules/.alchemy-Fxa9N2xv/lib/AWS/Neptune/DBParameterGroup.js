import * as neptune from "@distilled.cloud/aws/neptune";
import * as Effect from "effect/Effect";
import * as Schedule from "effect/Schedule";
import * as Stream from "effect/Stream";
import { isResolved } from "../../Diff.js";
import { createPhysicalName } from "../../PhysicalName.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
import { createInternalTags, diffTags } from "../../Tags.js";
/**
 * An Amazon Neptune DB (instance-level) parameter group — a named set of
 * engine configuration parameters applied to individual Neptune
 * {@link DBInstance}s via `dbParameterGroupName` (cluster-wide settings live
 * in a {@link DBClusterParameterGroup} instead).
 * ### Creating a Parameter Group
 * **Example:** Parameter group with a custom query timeout
 * ```typescript
 * const params = yield* DBParameterGroup("InstanceParams", {
 *   family: "neptune1.4",
 *   parameters: {
 *     neptune_query_timeout: "120000",
 *   },
 * });
 * ```
 *
 * ### Attaching to an Instance
 * **Example:** Instance using the parameter group
 * ```typescript
 * const writer = yield* DBInstance("Writer", {
 *   dbClusterIdentifier: cluster.dbClusterIdentifier,
 *   dbInstanceClass: "db.serverless",
 *   dbParameterGroupName: params.dbParameterGroupName,
 * });
 * ```
 *
 * @resource
 */
export const DBParameterGroup = Resource("AWS.Neptune.DBParameterGroup");
const toTagRecord = (tags) => Object.fromEntries((tags ?? [])
    .filter((tag) => typeof tag.Key === "string" && typeof tag.Value === "string")
    .map((tag) => [tag.Key, tag.Value]));
/**
 * A parameter modify/reset issued immediately after another change fails with
 * `InvalidDBParameterGroupStateFault` ("has pending changes") until the prior
 * change settles — retry it on a short bounded schedule.
 */
const retryWhileParameterGroupBusy = (self) => Effect.retry(self, {
    while: (e) => e._tag === "InvalidDBParameterGroupStateFault",
    schedule: Schedule.max([Schedule.fixed("5 seconds"), Schedule.recurs(10)]),
});
export const DBParameterGroupProvider = () => Provider.effect(DBParameterGroup, Effect.gen(function* () {
    const toName = (id, props) => props.dbParameterGroupName
        ? Effect.succeed(props.dbParameterGroupName)
        : createPhysicalName({ id, maxLength: 255 });
    const readGroup = Effect.fn(function* (groupName) {
        const response = yield* neptune
            .describeDBParameterGroups({
            DBParameterGroupName: groupName,
        })
            .pipe(Effect.catchTag("DBParameterGroupNotFoundFault", () => Effect.succeed(undefined)));
        return response?.DBParameterGroups?.[0];
    });
    // All parameters (defaults + overrides) with their current values and
    // apply types — the observed baseline for the parameter sync.
    const readParameters = Effect.fn(function* (groupName) {
        return yield* neptune.describeDBParameters
            .pages({ DBParameterGroupName: groupName })
            .pipe(Stream.runCollect, Effect.map((chunk) => Array.from(chunk).flatMap((page) => page.Parameters ?? [])));
    });
    // The subset of parameters the user has overridden (Source `user`) —
    // used to compute resets when a prop entry is removed.
    const readUserParameters = Effect.fn(function* (groupName) {
        return yield* neptune.describeDBParameters
            .pages({ DBParameterGroupName: groupName, Source: "user" })
            .pipe(Stream.runCollect, Effect.map((chunk) => Array.from(chunk).flatMap((page) => page.Parameters ?? [])));
    });
    const readTags = Effect.fn(function* (arn) {
        if (!arn)
            return {};
        const response = yield* neptune.listTagsForResource({
            ResourceName: arn,
        });
        return toTagRecord(response?.TagList);
    });
    const toUserParameterRecord = (parameters) => Object.fromEntries(parameters.flatMap((p) => p.ParameterName !== undefined && p.ParameterValue !== undefined
        ? [[p.ParameterName, p.ParameterValue]]
        : []));
    return {
        stables: ["dbParameterGroupArn", "dbParameterGroupName", "family"],
        diff: Effect.fn(function* ({ id, olds, news }) {
            if (!isResolved(news))
                return undefined;
            if ((yield* toName(id, olds ?? { family: "" })) !==
                (yield* toName(id, news))) {
                return { action: "replace" };
            }
            // Family is immutable — any change forces a fresh group.
            if (olds !== undefined && olds.family !== news.family) {
                return { action: "replace" };
            }
        }),
        read: Effect.fn(function* ({ id, olds, output }) {
            const name = output?.dbParameterGroupName ??
                (yield* toName(id, olds ?? { family: "" }));
            const group = yield* readGroup(name);
            if (!group?.DBParameterGroupName) {
                return undefined;
            }
            const userParameters = yield* readUserParameters(name);
            const tags = yield* readTags(group.DBParameterGroupArn);
            return {
                dbParameterGroupName: group.DBParameterGroupName,
                dbParameterGroupArn: group.DBParameterGroupArn,
                family: group.DBParameterGroupFamily ?? "",
                description: group.Description,
                parameters: toUserParameterRecord(userParameters),
                tags,
            };
        }),
        reconcile: Effect.fn(function* ({ id, news, output, session }) {
            const name = output?.dbParameterGroupName ?? (yield* toName(id, news));
            const internalTags = yield* createInternalTags(id);
            const desiredTags = { ...internalTags, ...news.tags };
            // Observe — fetch live parameter-group state.
            let observed = yield* readGroup(name);
            // Ensure — create if missing. Tolerate
            // `DBParameterGroupAlreadyExistsFault` as a race with a peer
            // reconciler by re-reading.
            if (!observed?.DBParameterGroupName) {
                yield* neptune
                    .createDBParameterGroup({
                    DBParameterGroupName: name,
                    DBParameterGroupFamily: news.family,
                    Description: news.description ?? "Managed by Alchemy",
                    Tags: Object.entries(desiredTags).map(([Key, Value]) => ({
                        Key,
                        Value,
                    })),
                })
                    .pipe(Effect.catchTag("DBParameterGroupAlreadyExistsFault", () => Effect.void));
                observed = yield* readGroup(name);
                if (!observed?.DBParameterGroupName) {
                    return yield* Effect.fail(new Error(`Failed to create DB parameter group '${name}'`));
                }
            }
            // Sync parameters — diff observed cloud values against desired.
            const desiredParameters = news.parameters ?? {};
            const allParameters = yield* readParameters(name);
            const byName = new Map(allParameters.map((p) => [p.ParameterName, p]));
            const toModify = Object.entries(desiredParameters).flatMap(([ParameterName, ParameterValue]) => {
                const current = byName.get(ParameterName);
                if (current?.ParameterValue === ParameterValue)
                    return [];
                return [
                    {
                        ParameterName,
                        ParameterValue,
                        ApplyMethod: current?.ApplyType === "static"
                            ? "pending-reboot"
                            : "immediate",
                    },
                ];
            });
            if (toModify.length > 0) {
                // The API caps a single call at 20 parameters.
                for (let i = 0; i < toModify.length; i += 20) {
                    yield* retryWhileParameterGroupBusy(neptune.modifyDBParameterGroup({
                        DBParameterGroupName: name,
                        Parameters: toModify.slice(i, i + 20),
                    }));
                }
            }
            // Reset user-overridden parameters that were removed from props.
            const userParameters = yield* readUserParameters(name);
            const toReset = userParameters.flatMap((p) => p.ParameterName !== undefined &&
                !(p.ParameterName in desiredParameters)
                ? [
                    {
                        ParameterName: p.ParameterName,
                        ApplyMethod: p.ApplyType === "static"
                            ? "pending-reboot"
                            : "immediate",
                    },
                ]
                : []);
            if (toReset.length > 0) {
                for (let i = 0; i < toReset.length; i += 20) {
                    yield* retryWhileParameterGroupBusy(neptune.resetDBParameterGroup({
                        DBParameterGroupName: name,
                        ResetAllParameters: false,
                        Parameters: toReset.slice(i, i + 20),
                    }));
                }
            }
            const arn = observed.DBParameterGroupArn;
            // Sync tags — diff observed cloud tags against desired.
            const observedTags = yield* readTags(arn);
            const { removed, upsert } = diffTags(observedTags, desiredTags);
            if (upsert.length > 0 && arn) {
                yield* neptune.addTagsToResource({
                    ResourceName: arn,
                    Tags: upsert,
                });
            }
            if (removed.length > 0 && arn) {
                yield* neptune.removeTagsFromResource({
                    ResourceName: arn,
                    TagKeys: removed,
                });
            }
            yield* session.note(arn ?? name);
            return {
                dbParameterGroupName: observed.DBParameterGroupName,
                dbParameterGroupArn: arn,
                family: observed.DBParameterGroupFamily ?? news.family,
                description: observed.Description,
                parameters: desiredParameters,
                tags: desiredTags,
            };
        }),
        list: () => 
        // AWS account/region collection: the RDS-family control plane
        // serves parameter groups for every engine, so keep only families
        // beginning with `neptune`. Hydrating per-group parameters/tags
        // would fan out one call per item — emit empty maps instead.
        neptune.describeDBParameterGroups.pages({}).pipe(Stream.runCollect, Effect.map((chunk) => Array.from(chunk).flatMap((page) => (page.DBParameterGroups ?? []).flatMap((group) => group.DBParameterGroupName &&
            group.DBParameterGroupFamily?.startsWith("neptune")
            ? [
                {
                    dbParameterGroupName: group.DBParameterGroupName,
                    dbParameterGroupArn: group.DBParameterGroupArn,
                    family: group.DBParameterGroupFamily,
                    description: group.Description,
                    parameters: {},
                    tags: {},
                },
            ]
            : [])))),
        delete: Effect.fn(function* ({ output }) {
            yield* neptune
                .deleteDBParameterGroup({
                DBParameterGroupName: output.dbParameterGroupName,
            })
                .pipe(Effect.catchTag("DBParameterGroupNotFoundFault", () => Effect.void));
        }),
    };
}));
//# sourceMappingURL=DBParameterGroup.js.map