import * as codedeploy from "@distilled.cloud/aws/codedeploy";
import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";
import { Unowned } from "../../AdoptPolicy.js";
import { isResolved } from "../../Diff.js";
import { createPhysicalName } from "../../PhysicalName.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
import { createInternalTags, diffTags, hasAlchemyTags } from "../../Tags.js";
import { AWSEnvironment } from "../Environment.js";
/**
 * An AWS CodeDeploy application — a logical container that groups the
 * deployment groups and revisions for a single deployable unit on a given
 * compute platform (EC2/on-prem `Server`, `Lambda`, or `ECS`).
 *
 * ### Creating an Application
 * **Example:** Lambda Application
 * ```typescript
 * const app = yield* CodeDeploy.Application("api", {
 *   computePlatform: "Lambda",
 * });
 * ```
 *
 * **Example:** EC2/On-Premises Application
 * ```typescript
 * const app = yield* CodeDeploy.Application("web", {
 *   applicationName: "web-fleet",
 *   computePlatform: "Server",
 *   tags: { team: "platform" },
 * });
 * ```
 *
 * @resource
 */
export const Application = Resource("AWS.CodeDeploy.Application");
/** Build the ARN for a CodeDeploy application. */
const applicationArn = (region, account, name) => `arn:aws:codedeploy:${region}:${account}:application:${name}`;
/** Convert a CodeDeploy wire tag list into a plain record. */
const toTagRecord = (tags) => Object.fromEntries((tags ?? [])
    .filter((tag) => typeof tag.Key === "string" && typeof tag.Value === "string")
    .map((tag) => [tag.Key, tag.Value]));
export const ApplicationProvider = () => Provider.effect(Application, Effect.gen(function* () {
    const toName = (id, props) => props.applicationName
        ? Effect.succeed(props.applicationName)
        : createPhysicalName({ id, maxLength: 100 });
    const getApplication = Effect.fn(function* (name) {
        const response = yield* codedeploy
            .getApplication({ applicationName: name })
            .pipe(Effect.catchTag("ApplicationDoesNotExistException", () => Effect.succeed(undefined)));
        return response?.application;
    });
    const syncTags = Effect.fn(function* (arn, desiredTags) {
        const observed = yield* codedeploy
            .listTagsForResource({ ResourceArn: arn })
            .pipe(Effect.catch(() => Effect.succeed(undefined)));
        const { removed, upsert } = diffTags(toTagRecord(observed?.Tags), desiredTags);
        if (upsert.length > 0) {
            yield* codedeploy.tagResource({ ResourceArn: arn, Tags: upsert });
        }
        if (removed.length > 0) {
            yield* codedeploy.untagResource({
                ResourceArn: arn,
                TagKeys: removed,
            });
        }
    });
    return {
        stables: ["applicationName", "applicationId", "computePlatform"],
        diff: Effect.fn(function* ({ id, olds, news }) {
            if (!isResolved(news))
                return undefined;
            if ((yield* toName(id, olds ?? {})) !== (yield* toName(id, news ?? {}))) {
                return { action: "replace" };
            }
            // Compute platform is immutable — replace on change.
            if ((news?.computePlatform ?? "Server") !==
                (olds?.computePlatform ?? "Server")) {
                return { action: "replace" };
            }
        }),
        read: Effect.fn(function* ({ id, olds, output }) {
            const { accountId, region } = yield* AWSEnvironment.current;
            const name = output?.applicationName ?? (yield* toName(id, olds ?? {}));
            const application = yield* getApplication(name);
            if (application?.applicationId === undefined)
                return undefined;
            const arn = applicationArn(region, accountId, name);
            const attrs = {
                applicationName: application.applicationName ?? name,
                applicationId: application.applicationId,
                applicationArn: arn,
                computePlatform: application.computePlatform ?? "Server",
            };
            const tags = yield* codedeploy
                .listTagsForResource({ ResourceArn: arn })
                .pipe(Effect.map((res) => toTagRecord(res.Tags)), Effect.catch(() => Effect.succeed({})));
            return (yield* hasAlchemyTags(id, tags)) ? attrs : Unowned(attrs);
        }),
        reconcile: Effect.fn(function* ({ id, news, output, session }) {
            const { accountId, region } = yield* AWSEnvironment.current;
            const name = output?.applicationName ?? (yield* toName(id, news));
            const arn = applicationArn(region, accountId, name);
            const computePlatform = news.computePlatform ?? "Server";
            const internalTags = yield* createInternalTags(id);
            const desiredTags = { ...internalTags, ...news.tags };
            // 1. Observe — cloud state is authoritative.
            let application = yield* getApplication(name);
            // 2. Ensure — create if missing. Tolerate an already-exists race.
            if (application?.applicationId === undefined) {
                yield* codedeploy
                    .createApplication({
                    applicationName: name,
                    computePlatform,
                    tags: Object.entries(desiredTags).map(([Key, Value]) => ({
                        Key,
                        Value,
                    })),
                })
                    .pipe(Effect.catchTag("ApplicationAlreadyExistsException", () => Effect.succeed(undefined)));
                application = yield* getApplication(name);
            }
            // 3. Sync tags — diff against OBSERVED cloud tags.
            yield* syncTags(arn, desiredTags);
            // 4. Return fresh attributes.
            yield* session.note(name);
            return {
                applicationName: application?.applicationName ?? name,
                applicationId: application?.applicationId ?? "",
                applicationArn: arn,
                computePlatform: application?.computePlatform ?? computePlatform,
            };
        }),
        delete: Effect.fn(function* ({ output }) {
            // DeleteApplication is idempotent — deleting a non-existent
            // application succeeds (no not-found variant in its error union).
            yield* codedeploy.deleteApplication({
                applicationName: output.applicationName,
            });
        }),
        list: () => Effect.gen(function* () {
            const { accountId, region } = yield* AWSEnvironment.current;
            const names = yield* codedeploy.listApplications.pages({}).pipe(Stream.runCollect, Effect.map((chunk) => Array.from(chunk).flatMap((page) => page.applications ?? [])));
            return names.map((name) => ({
                applicationName: name,
                applicationId: "",
                applicationArn: applicationArn(region, accountId, name),
                computePlatform: "",
            }));
        }),
    };
}));
//# sourceMappingURL=Application.js.map