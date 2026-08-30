import * as config from "@distilled.cloud/aws/config-service";
import * as Effect from "effect/Effect";
import * as Schedule from "effect/Schedule";
import { Unowned } from "../../AdoptPolicy.js";
import { isResolved } from "../../Diff.js";
import { createPhysicalName } from "../../PhysicalName.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
import { createInternalTags, createTagsList, diffTags, hasAlchemyTags, } from "../../Tags.js";
/**
 * The AWS Config configuration recorder that detects and records changes to
 * your AWS resource configurations.
 *
 * AWS allows only **one** customer managed configuration recorder per
 * account per region — treat this resource as an account-region singleton.
 * Starting the recorder (`recording: true`) requires a delivery channel
 * (see `AWS.Config.DeliveryChannel`) and incurs per-configuration-item
 * charges.
 * ### Creating the Recorder
 * **Example:** Recorder with the Config service-linked role
 * ```typescript
 * import * as Config from "alchemy/AWS/Config";
 *
 * const recorder = yield* Config.ConfigurationRecorder("Recorder", {
 *   roleArn: `arn:aws:iam::${accountId}:role/aws-service-role/config.amazonaws.com/AWSServiceRoleForConfig`,
 *   recordingGroup: { allSupported: true },
 * });
 * ```
 *
 * **Example:** Record only specific resource types
 * ```typescript
 * const recorder = yield* Config.ConfigurationRecorder("Recorder", {
 *   roleArn: serviceLinkedRoleArn,
 *   recordingGroup: {
 *     resourceTypes: ["AWS::S3::Bucket", "AWS::EC2::SecurityGroup"],
 *   },
 * });
 * ```
 *
 * ### Recording State
 * **Example:** Start recording (requires a delivery channel)
 * ```typescript
 * const channel = yield* Config.DeliveryChannel("Channel", {
 *   s3BucketName: bucket.bucketName,
 * });
 * const recorder = yield* Config.ConfigurationRecorder("Recorder", {
 *   roleArn: serviceLinkedRoleArn,
 *   recording: true,
 * });
 * ```
 *
 * @resource
 */
export const ConfigurationRecorder = Resource("AWS.Config.ConfigurationRecorder");
/**
 * A recorder role that was just created can be transiently rejected with
 * `InvalidRoleException` until IAM propagates. Bounded retry (~40s).
 *
 * Explicitly typed: inlining `Effect.retry` with options in provider
 * lifecycle code can widen the provider layer to `unknown` in declaration
 * emit.
 *
 * @internal
 */
const retryWhileInvalidRole = (self) => Effect.retry(self, {
    while: (e) => e._tag === "InvalidRoleException",
    schedule: Schedule.max([Schedule.fixed("2 seconds"), Schedule.recurs(20)]),
});
export const ConfigurationRecorderProvider = () => Provider.effect(ConfigurationRecorder, Effect.gen(function* () {
    const createRecorderName = Effect.fn(function* (id, props) {
        return (props.name ?? (yield* createPhysicalName({ id, maxLength: 256 })));
    });
    const toWireRecordingGroup = (group) => group === undefined
        ? undefined
        : {
            allSupported: group.allSupported,
            includeGlobalResourceTypes: group.includeGlobalResourceTypes,
            resourceTypes: group.resourceTypes,
            exclusionByResourceTypes: group.exclusionByResourceTypes,
            recordingStrategy: group.recordingStrategy,
        };
    const toWireRecordingMode = (mode) => mode === undefined
        ? undefined
        : {
            recordingFrequency: mode.recordingFrequency,
            recordingModeOverrides: mode.recordingModeOverrides,
        };
    const observeRecorder = Effect.fn(function* (name) {
        const response = yield* config
            .describeConfigurationRecorders({
            ConfigurationRecorderNames: [name],
        })
            .pipe(Effect.catchTag("NoSuchConfigurationRecorderException", () => Effect.succeed({ ConfigurationRecorders: [] })));
        return (response.ConfigurationRecorders ?? []).at(0);
    });
    const observedTags = (arn) => config.listTagsForResource({ ResourceArn: arn }).pipe(Effect.map((r) => Object.fromEntries((r.Tags ?? []).flatMap((t) => t.Key !== undefined ? [[t.Key, t.Value ?? ""]] : []))), Effect.catchTag("ResourceNotFoundException", () => Effect.succeed({})));
    return ConfigurationRecorder.Provider.of({
        stables: ["recorderName", "recorderArn"],
        list: () => config.describeConfigurationRecorders({}).pipe(Effect.map((response) => (response.ConfigurationRecorders ?? []).flatMap((recorder) => recorder.name && recorder.arn
            ? [
                {
                    recorderName: recorder.name,
                    recorderArn: recorder.arn,
                },
            ]
            : []))),
        read: Effect.fn(function* ({ id, olds, output }) {
            const name = output?.recorderName ?? (yield* createRecorderName(id, olds ?? {}));
            const recorder = yield* observeRecorder(name);
            if (recorder?.arn === undefined)
                return undefined;
            const attrs = { recorderName: name, recorderArn: recorder.arn };
            const tags = yield* observedTags(recorder.arn);
            return (yield* hasAlchemyTags(id, tags)) ? attrs : Unowned(attrs);
        }),
        diff: Effect.fn(function* ({ id, news, olds }) {
            if (!isResolved(news))
                return undefined;
            const oldName = yield* createRecorderName(id, olds ?? {});
            const newName = yield* createRecorderName(id, news);
            if (oldName !== newName) {
                return { action: "replace" };
            }
            // fall through: engine default update logic for mutable fields
        }),
        reconcile: Effect.fn(function* ({ id, news, output, session }) {
            const name = output?.recorderName ?? (yield* createRecorderName(id, news));
            const internalTags = yield* createInternalTags(id);
            const desiredTags = { ...news.tags, ...internalTags };
            const desiredGroup = toWireRecordingGroup(news.recordingGroup);
            const desiredMode = toWireRecordingMode(news.recordingMode);
            // 1. OBSERVE — cloud state is authoritative.
            const observed = yield* observeRecorder(name);
            // 2+3. ENSURE + SYNC — PutConfigurationRecorder is a full upsert;
            //    apply when missing or when a user-declared aspect drifted
            //    (fields AWS defaults are only compared when declared).
            const inSync = observed !== undefined &&
                observed.roleARN === news.roleArn &&
                (desiredGroup === undefined ||
                    JSON.stringify(observed.recordingGroup) ===
                        JSON.stringify({
                            ...observed.recordingGroup,
                            ...desiredGroup,
                        })) &&
                (desiredMode === undefined ||
                    JSON.stringify(observed.recordingMode) ===
                        JSON.stringify({ ...observed.recordingMode, ...desiredMode }));
            if (!inSync) {
                yield* retryWhileInvalidRole(config.putConfigurationRecorder({
                    ConfigurationRecorder: {
                        name,
                        roleARN: news.roleArn,
                        recordingGroup: desiredGroup,
                        recordingMode: desiredMode,
                    },
                    Tags: createTagsList(desiredTags),
                }));
            }
            // Re-observe for the ARN (Put returns an empty body).
            const live = yield* observeRecorder(name);
            const recorderArn = live?.arn ?? output?.recorderArn;
            // 3b. SYNC TAGS — diff against OBSERVED cloud tags.
            if (recorderArn !== undefined) {
                const currentTags = yield* observedTags(recorderArn);
                const { upsert, removed } = diffTags(currentTags, desiredTags);
                if (upsert.length > 0) {
                    yield* config.tagResource({
                        ResourceArn: recorderArn,
                        Tags: upsert,
                    });
                }
                if (removed.length > 0) {
                    yield* config.untagResource({
                        ResourceArn: recorderArn,
                        TagKeys: removed,
                    });
                }
            }
            // 3c. SYNC RECORDING STATE — only when the user declared a desired
            //     state; diff against the OBSERVED status.
            if (news.recording !== undefined) {
                const status = yield* config
                    .describeConfigurationRecorderStatus({
                    ConfigurationRecorderNames: [name],
                })
                    .pipe(Effect.map((r) => (r.ConfigurationRecordersStatus ?? []).at(0)?.recording ??
                    false), Effect.catchTag("NoSuchConfigurationRecorderException", () => Effect.succeed(false)));
                if (news.recording && !status) {
                    yield* config.startConfigurationRecorder({
                        ConfigurationRecorderName: name,
                    });
                }
                else if (!news.recording && status) {
                    yield* config.stopConfigurationRecorder({
                        ConfigurationRecorderName: name,
                    });
                }
            }
            yield* session.note(name);
            return { recorderName: name, recorderArn: recorderArn };
        }),
        delete: Effect.fn(function* ({ output }) {
            // A recorder must be stopped before it can be deleted; both calls
            // treat an already-gone recorder as success.
            yield* config
                .stopConfigurationRecorder({
                ConfigurationRecorderName: output.recorderName,
            })
                .pipe(Effect.catchTag("NoSuchConfigurationRecorderException", () => Effect.void));
            yield* config
                .deleteConfigurationRecorder({
                ConfigurationRecorderName: output.recorderName,
            })
                .pipe(Effect.catchTag("NoSuchConfigurationRecorderException", () => Effect.void));
        }),
    });
}));
//# sourceMappingURL=ConfigurationRecorder.js.map