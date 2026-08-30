import * as mq from "@distilled.cloud/aws/mq";
import * as Effect from "effect/Effect";
import { Unowned } from "../../AdoptPolicy.js";
import { isResolved } from "../../Diff.js";
import { createPhysicalName } from "../../PhysicalName.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
import { createInternalTags, hasAlchemyTags } from "../../Tags.js";
import { syncMqTags, toTagRecord } from "./internal.js";
/**
 * An Amazon MQ broker configuration — a versioned document (ActiveMQ XML or
 * RabbitMQ Cuttlefish) that a {@link Broker} can reference to control
 * engine-level settings. Each edit to `data` publishes a new immutable
 * revision; a broker pins a specific `{ id, revision }` pair.
 *
 * ### Creating a Configuration
 * **Example:** Default ActiveMQ Configuration
 * ```typescript
 * const config = yield* MQ.Configuration("BrokerConfig", {
 *   engineType: "ACTIVEMQ",
 *   engineVersion: "5.18",
 * });
 * ```
 *
 * **Example:** Custom ActiveMQ Configuration Document
 * ```typescript
 * const config = yield* MQ.Configuration("BrokerConfig", {
 *   engineType: "ACTIVEMQ",
 *   engineVersion: "5.18",
 *   description: "Enable statistics plugin",
 *   data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
 * <broker xmlns="http://activemq.apache.org/schema/core">
 *   <plugins>
 *     <statisticsBrokerPlugin/>
 *   </plugins>
 * </broker>`,
 * });
 * // config.configurationRevision -> 2 (the published revision)
 * ```
 *
 * ### Attaching to a Broker
 * **Example:** Reference a Configuration from a Broker
 * ```typescript
 * const broker = yield* MQ.Broker("Orders", {
 *   engineType: "ACTIVEMQ",
 *   engineVersion: "5.18",
 *   hostInstanceType: "mq.t3.micro",
 *   users: [{ username: "admin", password: Redacted.make("SuperSecretPassw0rd") }],
 *   configuration: {
 *     id: config.configurationId,
 *     revision: config.configurationRevision,
 *   },
 * });
 * ```
 *
 * @resource
 */
export const Configuration = Resource("AWS.MQ.Configuration");
const encodeData = (data) => Effect.sync(() => Buffer.from(data, "utf8").toString("base64"));
const decodeData = (data) => Effect.sync(() => data === undefined ? "" : Buffer.from(data, "base64").toString("utf8"));
export const ConfigurationProvider = () => Provider.effect(Configuration, Effect.gen(function* () {
    const toName = (id, props) => props.configurationName
        ? Effect.succeed(props.configurationName)
        : createPhysicalName({ id, maxLength: 150 });
    /** Read a configuration by id; a missing configuration reads as absent. */
    const readConfiguration = Effect.fn(function* (configurationId) {
        return yield* mq
            .describeConfiguration({ ConfigurationId: configurationId })
            .pipe(Effect.catchTag("NotFoundException", () => Effect.succeed(undefined)));
    });
    /** Enumerate all configurations (listConfigurations is not paginated). */
    const listAllConfigurations = Effect.fn(function* () {
        const configs = [];
        let nextToken;
        // Bounded page walk — MQ terminates on an absent NextToken.
        for (let page = 0; page < 20; page++) {
            const response = yield* mq.listConfigurations({
                MaxResults: 100,
                NextToken: nextToken,
            });
            configs.push(...(response.Configurations ?? []));
            nextToken = response.NextToken;
            if (!nextToken)
                break;
        }
        return configs;
    });
    /** Find a live configuration by name. */
    const findByName = Effect.fn(function* (name) {
        const configs = yield* listAllConfigurations();
        const summary = configs.find((c) => c.Name === name && c.Id);
        if (!summary?.Id)
            return undefined;
        return yield* readConfiguration(summary.Id);
    });
    const toAttrs = (config) => ({
        configurationId: config.Id,
        configurationArn: config.Arn,
        configurationName: config.Name,
        configurationRevision: config.LatestRevision?.Revision ?? 1,
        engineType: config.EngineType,
        engineVersion: config.EngineVersion,
    });
    return {
        stables: ["configurationId", "configurationArn", "configurationName"],
        diff: Effect.fn(function* ({ id, olds, news }) {
            if (!isResolved(news))
                return undefined;
            if ((yield* toName(id, olds ?? {})) !== (yield* toName(id, news ?? {}))) {
                return { action: "replace" };
            }
            // Engine type, version, and auth strategy are fixed at creation.
            if ((news.engineType ?? undefined) !== (olds?.engineType ?? undefined)) {
                return { action: "replace" };
            }
            if ((news.engineVersion ?? undefined) !==
                (olds?.engineVersion ?? undefined)) {
                return { action: "replace" };
            }
            if ((news.authenticationStrategy ?? undefined) !==
                (olds?.authenticationStrategy ?? undefined)) {
                return { action: "replace" };
            }
        }),
        read: Effect.fn(function* ({ id, olds, output }) {
            const config = output?.configurationId
                ? yield* readConfiguration(output.configurationId)
                : yield* findByName(yield* toName(id, olds ?? {}));
            if (config === undefined)
                return undefined;
            const attrs = toAttrs(config);
            const tags = toTagRecord(config.Tags);
            return (yield* hasAlchemyTags(id, tags)) ? attrs : Unowned(attrs);
        }),
        reconcile: Effect.fn(function* ({ id, news, output, session }) {
            const name = output?.configurationName ?? (yield* toName(id, news));
            const internalTags = yield* createInternalTags(id);
            const desiredTags = { ...internalTags, ...news.tags };
            // 1. Observe — cloud state is authoritative.
            let observed = output?.configurationId
                ? yield* readConfiguration(output.configurationId)
                : undefined;
            if (observed === undefined) {
                observed = yield* findByName(name);
            }
            // 2. Ensure — create if missing. createConfiguration seeds an
            // initial default revision; `data` (if any) is published below.
            if (observed === undefined) {
                const created = yield* mq.createConfiguration({
                    Name: name,
                    EngineType: news.engineType,
                    EngineVersion: news.engineVersion,
                    AuthenticationStrategy: news.authenticationStrategy,
                    Tags: desiredTags,
                });
                observed = yield* readConfiguration(created.Id);
                if (observed === undefined) {
                    return yield* Effect.fail(new Error(`MQ configuration '${name}' disappeared immediately after create`));
                }
            }
            const configurationId = observed.Id;
            // 3. Sync configuration document — publish a new revision only when
            // the desired `data` differs from the current latest revision.
            if (news.data !== undefined) {
                const revision = observed.LatestRevision?.Revision;
                const current = revision === undefined
                    ? undefined
                    : yield* mq.describeConfigurationRevision({
                        ConfigurationId: configurationId,
                        ConfigurationRevision: String(revision),
                    });
                const currentData = yield* decodeData(current?.Data);
                if (currentData !== news.data) {
                    yield* mq.updateConfiguration({
                        ConfigurationId: configurationId,
                        Data: yield* encodeData(news.data),
                        Description: news.description,
                    });
                }
            }
            // 3b. Sync tags — diff against OBSERVED cloud tags.
            yield* syncMqTags(observed.Arn, toTagRecord(observed.Tags), desiredTags);
            // 4. Re-read for the fresh latest revision + tags.
            const final = yield* readConfiguration(configurationId);
            if (final === undefined) {
                return yield* Effect.fail(new Error(`MQ configuration '${name}' disappeared while reconciling`));
            }
            yield* session.note(name);
            return toAttrs(final);
        }),
        delete: Effect.fn(function* ({ output }) {
            yield* mq
                .deleteConfiguration({ ConfigurationId: output.configurationId })
                .pipe(Effect.catchTag("NotFoundException", () => Effect.void));
        }),
        list: () => Effect.gen(function* () {
            const configs = yield* listAllConfigurations();
            return configs.flatMap((c) => c.Id !== undefined && c.Arn !== undefined && c.Name !== undefined
                ? [
                    {
                        configurationId: c.Id,
                        configurationArn: c.Arn,
                        configurationName: c.Name,
                        configurationRevision: c.LatestRevision?.Revision ?? 1,
                        engineType: c.EngineType,
                        engineVersion: c.EngineVersion,
                    },
                ]
                : []);
        }),
    };
}));
//# sourceMappingURL=Configuration.js.map