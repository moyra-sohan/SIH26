import * as appintegrations from "@distilled.cloud/aws/appintegrations";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";
import { Unowned } from "../../AdoptPolicy.js";
import { isResolved } from "../../Diff.js";
import { createPhysicalName } from "../../PhysicalName.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
import { createInternalTags, diffTags, hasAlchemyTags } from "../../Tags.js";
import { definedTags } from "./internal.js";
/**
 * An Amazon AppIntegrations application. Applications register external
 * (iframe-hosted) apps — most commonly Amazon Connect agent workspace
 * third-party applications — with a name, namespace, and the URL they are
 * served from.
 *
 * The namespace is immutable; changing it replaces the application. The
 * name, description, access URL, approved origins, and permissions can all
 * be updated in place.
 * ### Creating an Application
 * **Example:** Basic Application
 * ```typescript
 * import * as AppIntegrations from "alchemy/AWS/AppIntegrations";
 *
 * const app = yield* AppIntegrations.Application("AgentApp", {
 *   namespace: "com.example.agentapp",
 *   accessUrl: "https://example.com",
 * });
 * ```
 *
 * **Example:** Application with Permissions and Tags
 * ```typescript
 * const app = yield* AppIntegrations.Application("AgentApp", {
 *   namespace: "com.example.agentapp",
 *   accessUrl: "https://example.com",
 *   description: "Agent workspace application",
 *   permissions: ["User.Details.View"],
 *   tags: { team: "contact-center" },
 * });
 * ```
 *
 * @resource
 */
export const Application = Resource("AWS.AppIntegrations.Application");
/**
 * Raised when the AppIntegrations API returns an application without the
 * fields required to build the resource attributes.
 */
export class ApplicationIncomplete extends Data.TaggedError("AppIntegrationsApplicationIncomplete") {
}
export const ApplicationProvider = () => Provider.effect(Application, Effect.gen(function* () {
    const createName = Effect.fn(function* (id, props) {
        return (props.name ?? (yield* createPhysicalName({ id, maxLength: 255 })));
    });
    /** Get a single application by ARN or ID; undefined if absent. */
    const observe = (arnOrId) => appintegrations
        .getApplication({ Arn: arnOrId })
        .pipe(Effect.catchTag("ResourceNotFoundException", () => Effect.succeed(undefined)));
    /**
     * Find an application ARN by namespace via list enumeration. The
     * namespace is the account-unique key; the name is a generated
     * physical name whose instance-id suffix changes across lost-state
     * re-runs, so matching on it would miss the existing application and
     * `createApplication` would then fail with "Namespace already in use".
     */
    const findByNamespace = (namespace) => appintegrations.listApplications.items({}).pipe(Stream.filter((item) => item.Namespace === namespace), Stream.take(1), Stream.runCollect, Effect.map((chunk) => Array.from(chunk)[0]?.Arn));
    const toAttrs = Effect.fn(function* (live) {
        if (live.Arn === undefined ||
            live.Id === undefined ||
            live.Name === undefined ||
            live.Namespace === undefined) {
            return yield* new ApplicationIncomplete({
                message: `application '${live.Name}' is missing Arn, Id, Name, or Namespace`,
            });
        }
        return {
            applicationId: live.Id,
            applicationArn: live.Arn,
            applicationName: live.Name,
            namespace: live.Namespace,
        };
    });
    return Application.Provider.of({
        stables: ["applicationId", "applicationArn", "namespace"],
        list: () => appintegrations.listApplications.items({}).pipe(Stream.runCollect, Effect.map((chunk) => Array.from(chunk).flatMap((item) => item.Arn !== undefined &&
            item.Id !== undefined &&
            item.Name !== undefined &&
            item.Namespace !== undefined
            ? [
                {
                    applicationId: item.Id,
                    applicationArn: item.Arn,
                    applicationName: item.Name,
                    namespace: item.Namespace,
                },
            ]
            : []))),
        read: Effect.fn(function* ({ id, olds, output }) {
            let arn = output?.applicationArn;
            if (arn === undefined) {
                if (olds === undefined)
                    return undefined;
                arn = yield* findByNamespace(olds.namespace);
            }
            if (arn === undefined)
                return undefined;
            const live = yield* observe(arn);
            if (live === undefined)
                return undefined;
            const attrs = yield* toAttrs(live);
            const tags = definedTags(live.Tags);
            return (yield* hasAlchemyTags(id, tags)) ? attrs : Unowned(attrs);
        }),
        diff: Effect.fn(function* ({ news, olds }) {
            if (!isResolved(news))
                return undefined;
            if (olds === undefined)
                return undefined;
            if (olds.namespace !== news.namespace) {
                return { action: "replace" };
            }
            // fall through: default update path (name, description, source
            // config, permissions, tags are all mutable in place)
        }),
        reconcile: Effect.fn(function* ({ id, news, output, session }) {
            const name = yield* createName(id, news);
            const internalTags = yield* createInternalTags(id);
            const desiredTags = { ...news.tags, ...internalTags };
            const desiredSourceConfig = {
                ExternalUrlConfig: {
                    AccessUrl: news.accessUrl,
                    ...(news.approvedOrigins
                        ? { ApprovedOrigins: news.approvedOrigins }
                        : {}),
                },
            };
            // 1. Observe — prefer the cached ARN; fall back to enumerating by
            //    the unique namespace so a lost-state re-run converges even
            //    though the generated physical name changed.
            let arn = output?.applicationArn;
            let live = arn === undefined ? undefined : yield* observe(arn);
            if (live === undefined) {
                arn = yield* findByNamespace(news.namespace);
                live = arn === undefined ? undefined : yield* observe(arn);
            }
            // 2. Ensure — create if missing. A concurrent create can win the
            //    unique namespace between observe and create ("Namespace
            //    already in use" InvalidRequestException) — treat it as a race
            //    and re-observe; rethrow if the namespace holder still can't
            //    be found.
            if (live === undefined) {
                const created = yield* appintegrations
                    .createApplication({
                    Name: name,
                    Namespace: news.namespace,
                    Description: news.description,
                    ApplicationSourceConfig: desiredSourceConfig,
                    Permissions: news.permissions,
                    Tags: desiredTags,
                })
                    .pipe(Effect.catchTag("InvalidRequestException", (error) => Effect.gen(function* () {
                    const existing = yield* findByNamespace(news.namespace);
                    if (existing === undefined) {
                        return yield* Effect.fail(error);
                    }
                    return { Arn: existing };
                })));
                if (created.Arn === undefined) {
                    return yield* new ApplicationIncomplete({
                        message: `createApplication for '${name}' returned no Arn`,
                    });
                }
                arn = created.Arn;
                live = yield* appintegrations.getApplication({ Arn: arn });
            }
            const attrs = yield* toAttrs(live);
            // 3. Sync mutable aspects — compare observed cloud state against
            //    desired and push a single update with only the changed fields.
            const update = {};
            if (live.Name !== name) {
                update.Name = name;
            }
            if (news.description !== undefined &&
                news.description !== live.Description) {
                update.Description = news.description;
            }
            const observedUrlConfig = live.ApplicationSourceConfig?.ExternalUrlConfig;
            if (observedUrlConfig?.AccessUrl !== news.accessUrl ||
                JSON.stringify(observedUrlConfig?.ApprovedOrigins ?? []) !==
                    JSON.stringify(news.approvedOrigins ?? [])) {
                update.ApplicationSourceConfig = desiredSourceConfig;
            }
            if (news.permissions !== undefined &&
                JSON.stringify([...(live.Permissions ?? [])].sort()) !==
                    JSON.stringify([...news.permissions].sort())) {
                update.Permissions = news.permissions;
            }
            if (Object.keys(update).length > 0) {
                yield* appintegrations.updateApplication({
                    Arn: attrs.applicationArn,
                    ...update,
                });
            }
            // 4. Sync tags — diff against OBSERVED cloud tags so adoption
            //    converges.
            const observedTags = definedTags(live.Tags);
            const { upsert, removed } = diffTags(observedTags, desiredTags);
            if (upsert.length > 0) {
                yield* appintegrations.tagResource({
                    resourceArn: attrs.applicationArn,
                    tags: Object.fromEntries(upsert.map((t) => [t.Key, t.Value])),
                });
            }
            if (removed.length > 0) {
                yield* appintegrations.untagResource({
                    resourceArn: attrs.applicationArn,
                    tagKeys: removed,
                });
            }
            yield* session.note(name);
            return { ...attrs, applicationName: name };
        }),
        delete: Effect.fn(function* ({ output }) {
            yield* appintegrations
                .deleteApplication({ Arn: output.applicationArn })
                .pipe(Effect.catchTag("ResourceNotFoundException", () => Effect.void));
        }),
    });
}));
//# sourceMappingURL=Application.js.map