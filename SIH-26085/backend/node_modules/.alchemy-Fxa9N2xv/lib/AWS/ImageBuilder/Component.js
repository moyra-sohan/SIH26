import * as imagebuilder from "@distilled.cloud/aws/imagebuilder";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";
import { Unowned } from "../../AdoptPolicy.js";
import { createPhysicalName } from "../../PhysicalName.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
import { createInternalTags, hasAlchemyTags } from "../../Tags.js";
import { imageBuilderArn, immutableVersionKeysChanged, retryWhileDependedOn, syncImageBuilderTags, toTagRecord, } from "./internal.js";
/**
 * A Component must define its document inline (`data`) or point at an S3
 * object (`uri`) — exactly one of the two.
 */
export class ComponentSourceInvalid extends Data.TaggedError("AWS::ImageBuilder::ComponentSourceInvalid") {
}
/**
 * Image Builder component versions are immutable — the deployed document
 * differs from the desired one but the semantic version was not bumped, so
 * the cloud state cannot be converged.
 */
export class ComponentVersionImmutable extends Data.TaggedError("AWS::ImageBuilder::ComponentVersionImmutable") {
}
/**
 * An EC2 Image Builder component — a YAML document that defines the build,
 * validation, and test steps applied to an instance during image creation.
 *
 * Components are immutable versions: every property except `tags` replaces
 * the component. Bump `semanticVersion` when changing the document.
 * ### Creating a Component
 * **Example:** Inline Build Component
 * ```typescript
 * const component = yield* ImageBuilder.Component("Setup", {
 *   platform: "Linux",
 *   semanticVersion: "1.0.0",
 *   data: [
 *     "name: setup",
 *     "description: install packages",
 *     "schemaVersion: 1.2",
 *     "phases:",
 *     "  - name: build",
 *     "    steps:",
 *     "      - name: install",
 *     "        action: ExecuteBash",
 *     "        inputs:",
 *     "          commands:",
 *     "            - dnf install -y htop",
 * ].join("\n"),
 * });
 * ```
 *
 * ### Using in an Image Recipe
 * **Example:** Reference from a Recipe
 * ```typescript
 * const recipe = yield* ImageBuilder.ImageRecipe("Recipe", {
 *   parentImage: "arn:aws:imagebuilder:us-west-2:aws:image/amazon-linux-2023-x86/x.x.x",
 *   components: [{ componentArn: component.componentBuildVersionArn }],
 * });
 * ```
 *
 * @resource
 */
export const Component = Resource("AWS.ImageBuilder.Component");
export const ComponentProvider = () => Provider.effect(Component, Effect.gen(function* () {
    const toName = (id, props) => props.componentName
        ? Effect.succeed(props.componentName)
        : createPhysicalName({ id, maxLength: 126 });
    const toVersion = (props) => props.semanticVersion ?? "1.0.0";
    /**
     * CreateComponent always mints build version 1 for a fresh
     * name/version pair (subsequent creates of the same pair are
     * rejected), so the build-version ARN is deterministic.
     */
    const toBuildVersionArn = (name, version) => imageBuilderArn("component", `${name}/${version}/1`);
    const getComponent = Effect.fn(function* (arn) {
        const response = yield* imagebuilder
            .getComponent({ componentBuildVersionArn: arn })
            .pipe(Effect.catchTag("ResourceNotFoundException", () => Effect.succeed(undefined)));
        return response?.component;
    });
    const toAttrs = Effect.fn(function* (component) {
        if (!component.arn || !component.name || !component.version) {
            return yield* Effect.fail(new Error("Image Builder component is missing its ARN, name, or version"));
        }
        return {
            componentName: component.name,
            componentBuildVersionArn: component.arn,
            semanticVersion: component.version,
            platform: component.platform ?? "",
            type: component.type,
            dateCreated: component.dateCreated,
        };
    });
    return {
        stables: ["componentName", "semanticVersion"],
        // Components are immutable — any changed property except tags
        // replaces. Individual keys may still hold unresolved Outputs at
        // plan time; compare per key so a resolved change still plans a
        // replacement, and let the reconcile immutability guard catch
        // drift hidden behind an unresolved key.
        diff: Effect.fn(function* ({ olds, news }) {
            const immutableKeys = [
                "componentName",
                "semanticVersion",
                "platform",
                "data",
                "uri",
                "description",
                "changeDescription",
                "supportedOsVersions",
                "kmsKeyId",
            ];
            if (immutableVersionKeysChanged(olds, news, immutableKeys)) {
                return { action: "replace" };
            }
        }),
        read: Effect.fn(function* ({ id, olds, output }) {
            const arn = output?.componentBuildVersionArn ??
                (yield* toBuildVersionArn(yield* toName(id, olds), toVersion(olds)));
            const component = yield* getComponent(arn);
            if (component === undefined)
                return undefined;
            const attrs = yield* toAttrs(component);
            const tags = toTagRecord(component.tags);
            return (yield* hasAlchemyTags(id, tags)) ? attrs : Unowned(attrs);
        }),
        reconcile: Effect.fn(function* ({ id, news, output, session }) {
            // One idempotency token per reconcile — retries within this run
            // are deduplicated by the API.
            const clientToken = yield* Effect.sync(() => crypto.randomUUID());
            if ((news.data === undefined) === (news.uri === undefined)) {
                return yield* new ComponentSourceInvalid({
                    message: "Specify exactly one of `data` (inline YAML) or `uri` (S3 object) for an Image Builder component",
                });
            }
            const name = output?.componentName ?? (yield* toName(id, news));
            const version = output?.semanticVersion ?? toVersion(news);
            const internalTags = yield* createInternalTags(id);
            const desiredTags = { ...internalTags, ...news.tags };
            // 1. Observe — cloud state is authoritative; output only caches
            //    the build-version ARN.
            const arn = output?.componentBuildVersionArn ??
                (yield* toBuildVersionArn(name, version));
            let observed = yield* getComponent(arn);
            // Immutability guard — the version already exists in the cloud
            // with a different document. It cannot be converged in place; the
            // user must bump `semanticVersion` (which replaces the component).
            if (observed !== undefined &&
                news.data !== undefined &&
                observed.data !== news.data) {
                return yield* new ComponentVersionImmutable({
                    message: `Image Builder component '${name}' version '${version}' already exists with a different document — bump semanticVersion to publish the change`,
                });
            }
            // 2. Ensure — components are immutable, so a missing component is
            //    the only create path. A same-name/version conflict (race or
            //    an unbumped document change on a fixed name) surfaces as the
            //    API's typed error.
            if (observed === undefined) {
                const created = yield* imagebuilder.createComponent({
                    name,
                    semanticVersion: version,
                    platform: news.platform,
                    data: news.data,
                    uri: news.uri,
                    description: news.description,
                    changeDescription: news.changeDescription,
                    supportedOsVersions: news.supportedOsVersions,
                    kmsKeyId: news.kmsKeyId,
                    tags: desiredTags,
                    clientToken,
                });
                if (!created.componentBuildVersionArn) {
                    return yield* Effect.fail(new Error("CreateComponent returned no componentBuildVersionArn"));
                }
                observed = yield* getComponent(created.componentBuildVersionArn);
                if (observed === undefined) {
                    return yield* Effect.fail(new Error(`created Image Builder component '${name}' is not readable`));
                }
            }
            // 3. Sync — tags are the only mutable aspect; diff against
            //    OBSERVED cloud tags.
            if (observed.arn) {
                yield* syncImageBuilderTags(observed.arn, desiredTags);
            }
            // 4. Return fresh attributes.
            yield* session.note(name);
            return yield* toAttrs(observed);
        }),
        delete: Effect.fn(function* ({ output }) {
            yield* retryWhileDependedOn(imagebuilder.deleteComponent({
                componentBuildVersionArn: output.componentBuildVersionArn,
            })).pipe(Effect.catchTag("ResourceNotFoundException", () => Effect.void));
        }),
        list: () => imagebuilder.listComponents.pages({ owner: "Self" }).pipe(Stream.runCollect, Effect.map((chunk) => Array.from(chunk).flatMap((page) => (page.componentVersionList ?? []).filter((version) => version.arn !== undefined))), Effect.flatMap(Effect.forEach((version) => imagebuilder
            .listComponentBuildVersions({
            componentVersionArn: version.arn,
        })
            .pipe(Effect.map((response) => (response.componentSummaryList ?? []).filter((summary) => summary.arn !== undefined &&
            summary.name !== undefined &&
            summary.version !== undefined)), 
        // Tolerate a delete race — drop the version.
        Effect.catchTag("ResourceNotFoundException", () => Effect.succeed([]))), { concurrency: 4 })), Effect.map((groups) => groups.flat().map((summary) => ({
            componentName: summary.name,
            componentBuildVersionArn: summary.arn,
            semanticVersion: summary.version,
            platform: summary.platform ?? "",
            type: summary.type,
            dateCreated: summary.dateCreated,
        })))),
    };
}));
//# sourceMappingURL=Component.js.map