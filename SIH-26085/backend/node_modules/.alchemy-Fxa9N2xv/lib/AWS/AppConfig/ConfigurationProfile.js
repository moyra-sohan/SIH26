import * as appconfig from "@distilled.cloud/aws/appconfig";
import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";
import { Unowned } from "../../AdoptPolicy.js";
import { isResolved } from "../../Diff.js";
import { createPhysicalName } from "../../PhysicalName.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
import { createInternalTags, hasAlchemyTags } from "../../Tags.js";
import { AWSEnvironment } from "../Environment.js";
import { configurationProfileArn, readAppConfigTags, syncAppConfigTags, } from "./internal.js";
/**
 * An AWS AppConfig configuration profile — describes where the configuration
 * data lives (the AppConfig hosted store, S3, SSM, Secrets Manager, or
 * CodePipeline) and how to validate it.
 *
 * ### Creating a Configuration Profile
 * **Example:** Hosted Configuration Profile
 * ```typescript
 * const profile = yield* AppConfig.ConfigurationProfile("Settings", {
 *   applicationId: app.applicationId,
 *   locationUri: "hosted",
 * });
 * ```
 *
 * **Example:** S3-sourced Profile with a JSON Schema Validator
 * ```typescript
 * const profile = yield* AppConfig.ConfigurationProfile("Settings", {
 *   applicationId: app.applicationId,
 *   locationUri: "s3://my-bucket/config.json",
 *   retrievalRoleArn: role.roleArn,
 *   validators: [{ type: "JSON_SCHEMA", content: schemaJson }],
 * });
 * ```
 *
 * @resource
 */
export const ConfigurationProfile = Resource("AWS.AppConfig.ConfigurationProfile");
const toWireValidators = (validators) => validators?.map((v) => ({ Type: v.type, Content: v.content }));
export const ConfigurationProfileProvider = () => Provider.effect(ConfigurationProfile, Effect.gen(function* () {
    const toName = (id, props) => props.configurationProfileName
        ? Effect.succeed(props.configurationProfileName)
        : createPhysicalName({ id, maxLength: 64 });
    const readProfile = Effect.fn(function* (applicationId, configurationProfileId) {
        return yield* appconfig
            .getConfigurationProfile({
            ApplicationId: applicationId,
            ConfigurationProfileId: configurationProfileId,
        })
            .pipe(Effect.catchTag("ResourceNotFoundException", () => Effect.succeed(undefined)));
    });
    const findByName = Effect.fn(function* (applicationId, name) {
        const profiles = yield* appconfig.listConfigurationProfiles
            .pages({ ApplicationId: applicationId })
            .pipe(Stream.runCollect, Effect.map((chunk) => Array.from(chunk).flatMap((page) => page.Items ?? [])), Effect.catchTag("ResourceNotFoundException", () => Effect.succeed([])));
        const summary = profiles.find((p) => p.Name === name);
        if (summary?.Id === undefined)
            return undefined;
        return yield* readProfile(applicationId, summary.Id);
    });
    return {
        stables: [
            "configurationProfileId",
            "configurationProfileName",
            "applicationId",
            "locationUri",
            "configurationProfileArn",
        ],
        diff: Effect.fn(function* ({ id, olds, news }) {
            if (!isResolved(news))
                return undefined;
            if ((yield* toName(id, olds ?? {})) !== (yield* toName(id, news ?? {}))) {
                return { action: "replace" };
            }
            if ((olds?.applicationId ?? undefined) !== news?.applicationId) {
                return { action: "replace" };
            }
            // LocationUri and Type are create-only.
            if ((olds?.locationUri ?? "hosted") !== (news?.locationUri ?? "hosted")) {
                return { action: "replace" };
            }
            if ((olds?.type ?? "AWS.Freeform") !== (news?.type ?? "AWS.Freeform")) {
                return { action: "replace" };
            }
        }),
        read: Effect.fn(function* ({ id, olds, output }) {
            const { accountId, region } = yield* AWSEnvironment.current;
            const applicationId = output?.applicationId ?? olds?.applicationId;
            if (applicationId === undefined)
                return undefined;
            const profile = output?.configurationProfileId
                ? yield* readProfile(applicationId, output.configurationProfileId)
                : yield* findByName(applicationId, yield* toName(id, olds ?? {}));
            if (profile?.Id === undefined)
                return undefined;
            const arn = configurationProfileArn(region, accountId, applicationId, profile.Id);
            const attrs = {
                configurationProfileId: profile.Id,
                configurationProfileName: profile.Name,
                applicationId,
                locationUri: profile.LocationUri ?? "hosted",
                configurationProfileArn: arn,
            };
            const tags = yield* readAppConfigTags(arn);
            return (yield* hasAlchemyTags(id, tags)) ? attrs : Unowned(attrs);
        }),
        reconcile: Effect.fn(function* ({ id, news, output, session }) {
            const { accountId, region } = yield* AWSEnvironment.current;
            const applicationId = news.applicationId;
            const name = output?.configurationProfileName ?? (yield* toName(id, news));
            const locationUri = news.locationUri ?? "hosted";
            const internalTags = yield* createInternalTags(id);
            const desiredTags = { ...internalTags, ...news.tags };
            // 1. Observe.
            let observed = output?.configurationProfileId
                ? yield* readProfile(applicationId, output.configurationProfileId)
                : undefined;
            if (observed === undefined) {
                observed = yield* findByName(applicationId, name);
            }
            // 2. Ensure.
            if (observed?.Id === undefined) {
                observed = yield* appconfig.createConfigurationProfile({
                    ApplicationId: applicationId,
                    Name: name,
                    LocationUri: locationUri,
                    Description: news.description,
                    RetrievalRoleArn: news.retrievalRoleArn,
                    Validators: toWireValidators(news.validators),
                    Type: news.type,
                    KmsKeyIdentifier: news.kmsKeyIdentifier,
                    Tags: desiredTags,
                });
            }
            else {
                // 3. Sync — description, retrieval role, validators, and KMS key
                // are mutable in place.
                observed = yield* appconfig.updateConfigurationProfile({
                    ApplicationId: applicationId,
                    ConfigurationProfileId: observed.Id,
                    Description: news.description,
                    RetrievalRoleArn: news.retrievalRoleArn,
                    Validators: toWireValidators(news.validators),
                    KmsKeyIdentifier: news.kmsKeyIdentifier,
                });
            }
            const arn = configurationProfileArn(region, accountId, applicationId, observed.Id);
            // 3b. Sync tags.
            yield* syncAppConfigTags(arn, desiredTags);
            yield* session.note(name);
            return {
                configurationProfileId: observed.Id,
                configurationProfileName: observed.Name ?? name,
                applicationId,
                locationUri: observed.LocationUri ?? locationUri,
                configurationProfileArn: arn,
            };
        }),
        delete: Effect.fn(function* ({ output }) {
            // Hosted configuration versions block profile deletion, and
            // runtime writers (the CreateHostedConfigurationVersion binding)
            // can add versions the engine never tracked — delete whatever
            // versions remain before deleting the profile.
            const versions = yield* appconfig.listHostedConfigurationVersions
                .pages({
                ApplicationId: output.applicationId,
                ConfigurationProfileId: output.configurationProfileId,
            })
                .pipe(Stream.runCollect, Effect.map((chunk) => Array.from(chunk).flatMap((page) => page.Items ?? [])), Effect.catchTag("ResourceNotFoundException", () => Effect.succeed([])));
            for (const version of versions) {
                if (version.VersionNumber !== undefined) {
                    yield* appconfig
                        .deleteHostedConfigurationVersion({
                        ApplicationId: output.applicationId,
                        ConfigurationProfileId: output.configurationProfileId,
                        VersionNumber: version.VersionNumber,
                    })
                        .pipe(Effect.catchTag("ResourceNotFoundException", () => Effect.void));
                }
            }
            yield* appconfig
                .deleteConfigurationProfile({
                ApplicationId: output.applicationId,
                ConfigurationProfileId: output.configurationProfileId,
            })
                .pipe(Effect.catchTag("ResourceNotFoundException", () => Effect.void));
        }),
        // Configuration profiles are keyed under their parent application, so
        // enumeration walks every application and lists its profiles. An
        // application cannot be deleted while profiles exist under it, so
        // nuke needs these enumerated as first-class resources.
        list: () => Effect.gen(function* () {
            const { accountId, region } = yield* AWSEnvironment.current;
            const apps = yield* appconfig.listApplications.pages({}).pipe(Stream.runCollect, Effect.map((chunk) => Array.from(chunk).flatMap((page) => page.Items ?? [])));
            const results = [];
            for (const app of apps) {
                if (app.Id === undefined)
                    continue;
                const profiles = yield* appconfig.listConfigurationProfiles
                    .pages({ ApplicationId: app.Id })
                    .pipe(Stream.runCollect, Effect.map((chunk) => Array.from(chunk).flatMap((page) => page.Items ?? [])), 
                // The application may be deleted between the two calls.
                Effect.catchTag("ResourceNotFoundException", () => Effect.succeed([])));
                for (const profile of profiles) {
                    if (profile.Id === undefined || profile.Name === undefined) {
                        continue;
                    }
                    results.push({
                        configurationProfileId: profile.Id,
                        configurationProfileName: profile.Name,
                        applicationId: app.Id,
                        locationUri: profile.LocationUri ?? "hosted",
                        configurationProfileArn: configurationProfileArn(region, accountId, app.Id, profile.Id),
                    });
                }
            }
            return results;
        }),
    };
}));
//# sourceMappingURL=ConfigurationProfile.js.map