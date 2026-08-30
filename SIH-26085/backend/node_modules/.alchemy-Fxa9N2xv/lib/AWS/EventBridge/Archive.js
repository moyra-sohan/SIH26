import * as eventbridge from "@distilled.cloud/aws/eventbridge";
import * as Effect from "effect/Effect";
import * as Schedule from "effect/Schedule";
import { isResolved } from "../../Diff.js";
import { createPhysicalName } from "../../PhysicalName.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
import { toWireDays } from "../../Util/Duration.js";
import { AWSEnvironment } from "../Environment.js";
export const Archive = Resource("AWS.EventBridge.Archive");
export const ArchiveProvider = () => Provider.effect(Archive, Effect.gen(function* () {
    const createArchiveName = (id, props = {}) => props.name
        ? Effect.succeed(props.name)
        : createPhysicalName({
            id,
            maxLength: 48,
        });
    /**
     * Poll until the archive leaves its transitional state. Archive
     * creation/updates settle in seconds; the wait is bounded so a stuck
     * archive surfaces the last observed state instead of hanging.
     */
    const awaitSettled = (archiveName) => eventbridge.describeArchive({ ArchiveName: archiveName }).pipe(
    // A describe fired immediately after create can be eventually
    // consistent — absorb NotFound briefly before polling the state.
    Effect.retry({
        while: (e) => e._tag === "ResourceNotFoundException",
        schedule: Schedule.spaced("1 second"),
        times: 5,
    }), Effect.repeat({
        schedule: Schedule.spaced("2 seconds"),
        until: (r) => r.State !== "CREATING" && r.State !== "UPDATING",
        times: 10,
    }));
    return {
        stables: ["archiveName", "archiveArn", "eventSourceArn"],
        diff: Effect.fn(function* ({ id, news, olds }) {
            if (!isResolved(news))
                return;
            const oldName = yield* createArchiveName(id, olds);
            const newName = yield* createArchiveName(id, news);
            if (oldName !== newName) {
                return { action: "replace" };
            }
            if (olds.eventSourceArn !== news.eventSourceArn) {
                return { action: "replace" };
            }
        }),
        read: Effect.fn(function* ({ id, olds, output }) {
            // Archives don't support tags; the deterministic physical name is
            // the ownership signal (it embeds app/stage/logical id).
            const archiveName = output?.archiveName ?? (yield* createArchiveName(id, olds ?? {}));
            const described = yield* eventbridge
                .describeArchive({ ArchiveName: archiveName })
                .pipe(Effect.catchTag("ResourceNotFoundException", () => Effect.succeed(undefined)));
            if (!described?.ArchiveName || !described.ArchiveArn) {
                return undefined;
            }
            return {
                archiveName: described.ArchiveName,
                archiveArn: described.ArchiveArn,
                eventSourceArn: described.EventSourceArn ?? "",
            };
        }),
        list: () => Effect.gen(function* () {
            const { accountId, region } = yield* AWSEnvironment.current;
            const attrs = [];
            let nextToken;
            do {
                const page = yield* eventbridge.listArchives({
                    NextToken: nextToken,
                });
                for (const archive of page.Archives ?? []) {
                    if (!archive.ArchiveName) {
                        continue;
                    }
                    attrs.push({
                        archiveName: archive.ArchiveName,
                        archiveArn: `arn:aws:events:${region}:${accountId}:archive/${archive.ArchiveName}`,
                        eventSourceArn: archive.EventSourceArn ?? "",
                    });
                }
                nextToken = page.NextToken;
            } while (nextToken);
            return attrs;
        }),
        reconcile: Effect.fn(function* ({ id, news, output, session }) {
            const archiveName = output?.archiveName ?? (yield* createArchiveName(id, news));
            const eventPattern = news.eventPattern
                ? JSON.stringify(news.eventPattern)
                : undefined;
            const retentionDays = toWireDays(news.retention);
            // Observe — live cloud state is authoritative; a vanished archive
            // falls through to create.
            const observed = yield* eventbridge
                .describeArchive({ ArchiveName: archiveName })
                .pipe(Effect.catchTag("ResourceNotFoundException", () => Effect.succeed(undefined)));
            if (!observed?.ArchiveArn) {
                // Ensure — create the archive; tolerate an AlreadyExists race
                // with a peer reconciler and converge via the update below.
                yield* eventbridge
                    .createArchive({
                    ArchiveName: archiveName,
                    EventSourceArn: news.eventSourceArn,
                    Description: news.description,
                    EventPattern: eventPattern,
                    RetentionDays: retentionDays,
                    KmsKeyIdentifier: news.kmsKeyIdentifier,
                })
                    .pipe(Effect.catchTag("ResourceAlreadyExistsException", () => Effect.void));
            }
            else {
                // Sync — updateArchive overwrites description, pattern,
                // retention, and KMS key in one shot (idempotent on matching
                // values).
                yield* eventbridge.updateArchive({
                    ArchiveName: archiveName,
                    Description: news.description,
                    EventPattern: eventPattern,
                    RetentionDays: retentionDays,
                    KmsKeyIdentifier: news.kmsKeyIdentifier,
                });
            }
            const settled = yield* awaitSettled(archiveName);
            const archiveArn = (settled.ArchiveArn ??
                observed?.ArchiveArn);
            yield* session.note(archiveArn);
            return {
                archiveName,
                archiveArn,
                eventSourceArn: settled.EventSourceArn ?? news.eventSourceArn,
            };
        }),
        delete: Effect.fn(function* ({ output }) {
            yield* eventbridge
                .deleteArchive({ ArchiveName: output.archiveName })
                .pipe(Effect.catchTag("ResourceNotFoundException", () => Effect.void));
        }),
    };
}));
//# sourceMappingURL=Archive.js.map