import * as backup from "@distilled.cloud/aws/backup";
import * as Effect from "effect/Effect";
import * as Schedule from "effect/Schedule";
import * as Stream from "effect/Stream";
import { Unowned } from "../../AdoptPolicy.js";
import { createPhysicalName } from "../../PhysicalName.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
import { createInternalTags, diffTags, hasAlchemyTags } from "../../Tags.js";
import { toWireDays, toWireMinutes } from "../../Util/Duration.js";
/**
 * An AWS Backup plan — a policy expression that defines *when* and *how* you
 * want to back up your resources, composed of one or more scheduled rules
 * that each target a backup vault.
 *
 * Pair a plan with a {@link BackupSelection} to assign the AWS resources it
 * protects.
 *
 * ### Creating a Plan
 * **Example:** Daily backups retained for 30 days
 * ```typescript
 * import * as Backup from "alchemy/AWS/Backup";
 *
 * const vault = yield* Backup.BackupVault("AppBackups");
 *
 * const plan = yield* Backup.BackupPlan("DailyPlan", {
 *   rules: [
 *     {
 *       ruleName: "DailyBackups",
 *       targetBackupVaultName: vault.backupVaultName,
 *       scheduleExpression: "cron(0 5 ? * * *)",
 *       startWindow: "1 hour",
 *       completionWindow: "3 hours",
 *       lifecycle: { deleteAfter: "30 days" },
 *     },
 *   ],
 * });
 * ```
 *
 * **Example:** Move to cold storage then delete
 * ```typescript
 * const plan = yield* Backup.BackupPlan("ArchivePlan", {
 *   rules: [
 *     {
 *       ruleName: "MonthlyArchive",
 *       targetBackupVaultName: vault.backupVaultName,
 *       scheduleExpression: "cron(0 5 1 * ? *)",
 *       lifecycle: {
 *         moveToColdStorageAfter: "30 days",
 *         deleteAfter: "365 days",
 *       },
 *     },
 *   ],
 * });
 * ```
 *
 * @resource
 */
export const BackupPlan = Resource("AWS.Backup.BackupPlan");
const toRuleInput = (rule) => ({
    RuleName: rule.ruleName,
    TargetBackupVaultName: rule.targetBackupVaultName,
    ScheduleExpression: rule.scheduleExpression,
    ScheduleExpressionTimezone: rule.scheduleExpressionTimezone,
    StartWindowMinutes: toWireMinutes(rule.startWindow),
    CompletionWindowMinutes: toWireMinutes(rule.completionWindow),
    EnableContinuousBackup: rule.enableContinuousBackup,
    RecoveryPointTags: rule.recoveryPointTags,
    Lifecycle: rule.lifecycle
        ? {
            MoveToColdStorageAfterDays: toWireDays(rule.lifecycle.moveToColdStorageAfter),
            DeleteAfterDays: toWireDays(rule.lifecycle.deleteAfter),
            OptInToArchiveForSupportedResources: rule.lifecycle.optInToArchiveForSupportedResources,
        }
        : undefined,
});
export const BackupPlanProvider = () => Provider.effect(BackupPlan, Effect.gen(function* () {
    const createName = Effect.fn(function* (id, props) {
        return (props.backupPlanName ??
            (yield* createPhysicalName({ id, maxLength: 50 })));
    });
    return BackupPlan.Provider.of({
        stables: ["backupPlanId", "backupPlanArn"],
        list: () => backup.listBackupPlans.pages({}).pipe(Stream.runCollect, Effect.map((chunk) => Array.from(chunk)
            .flatMap((page) => page.BackupPlansList ?? [])
            .filter((p) => p.BackupPlanId !== undefined &&
            p.BackupPlanArn !== undefined &&
            // Service-managed plans (e.g. EFS automatic backups'
            // `aws/efs/automatic-backup-plan`) reject DeleteBackupPlan
            // with AccessDenied (verified live) — keep them out of
            // enumeration for account-wide teardown (nuke).
            !(p.BackupPlanName ?? "").startsWith("aws/"))
            .map((p) => ({
            backupPlanId: p.BackupPlanId,
            backupPlanArn: p.BackupPlanArn,
            backupPlanName: p.BackupPlanName ?? "",
            versionId: p.VersionId ?? "",
        })))),
        read: Effect.fn(function* ({ id, output }) {
            if (!output?.backupPlanId)
                return undefined;
            const found = yield* backup
                .getBackupPlan({ BackupPlanId: output.backupPlanId })
                .pipe(Effect.catchTag("ResourceNotFoundException", () => Effect.succeed(undefined)));
            if (!found?.BackupPlanArn)
                return undefined;
            const attrs = {
                backupPlanId: output.backupPlanId,
                backupPlanArn: found.BackupPlanArn,
                backupPlanName: found.BackupPlan?.BackupPlanName ?? output.backupPlanName,
                versionId: found.VersionId ?? output.versionId,
            };
            const tags = yield* backup
                .listTags({ ResourceArn: found.BackupPlanArn })
                .pipe(Effect.map((r) => r.Tags ?? {}), Effect.catch(() => Effect.succeed({})));
            return (yield* hasAlchemyTags(id, tags))
                ? attrs
                : Unowned(attrs);
        }),
        reconcile: Effect.fn(function* ({ id, news = {}, output, session }) {
            const name = output?.backupPlanName ?? (yield* createName(id, news));
            const internalTags = yield* createInternalTags(id);
            const backupPlanInput = {
                BackupPlanName: name,
                Rules: (news.rules ?? []).map(toRuleInput),
            };
            // OBSERVE — resolve the plan by its stable id when we have one.
            const live = output?.backupPlanId
                ? yield* backup
                    .getBackupPlan({ BackupPlanId: output.backupPlanId })
                    .pipe(Effect.catchTag("ResourceNotFoundException", () => Effect.succeed(undefined)))
                : undefined;
            let backupPlanId;
            let backupPlanArn;
            let versionId;
            if (!live?.BackupPlanArn) {
                // ENSURE — create.
                const created = yield* backup.createBackupPlan({
                    BackupPlan: backupPlanInput,
                    BackupPlanTags: { ...internalTags, ...news.tags },
                });
                backupPlanId = created.BackupPlanId;
                backupPlanArn = created.BackupPlanArn;
                versionId = created.VersionId ?? "";
            }
            else {
                // SYNC — a plan is a true upsert via updateBackupPlan; converge
                // rule/name changes unconditionally (the API is idempotent).
                backupPlanId = output.backupPlanId;
                const updated = yield* backup.updateBackupPlan({
                    BackupPlanId: backupPlanId,
                    BackupPlan: backupPlanInput,
                });
                backupPlanArn = updated.BackupPlanArn ?? live.BackupPlanArn;
                versionId = updated.VersionId ?? live.VersionId ?? "";
            }
            // SYNC tags — diff against observed cloud tags.
            const currentTags = yield* backup
                .listTags({ ResourceArn: backupPlanArn })
                .pipe(Effect.map((r) => r.Tags ?? {}), Effect.catch(() => Effect.succeed({})));
            const { upsert, removed } = diffTags(currentTags, { ...news.tags, ...internalTags });
            if (upsert.length > 0) {
                yield* backup.tagResource({
                    ResourceArn: backupPlanArn,
                    Tags: Object.fromEntries(upsert.map((t) => [t.Key, t.Value])),
                });
            }
            if (removed.length > 0) {
                yield* backup.untagResource({
                    ResourceArn: backupPlanArn,
                    TagKeyList: removed,
                });
            }
            yield* session.note(backupPlanId);
            return {
                backupPlanId,
                backupPlanArn,
                backupPlanName: name,
                versionId,
            };
        }),
        delete: Effect.fn(function* ({ output }) {
            // A plan cannot be deleted while it still has resource selections
            // attached — delete those first (idempotent: a vanished selection
            // is already gone).
            const selections = yield* backup.listBackupSelections
                .pages({ BackupPlanId: output.backupPlanId })
                .pipe(Stream.runCollect, Effect.map((chunk) => Array.from(chunk).flatMap((page) => page.BackupSelectionsList ?? [])), Effect.catchTag("ResourceNotFoundException", () => Effect.succeed([])));
            yield* Effect.forEach(selections, (s) => s.SelectionId
                ? backup
                    .deleteBackupSelection({
                    BackupPlanId: output.backupPlanId,
                    SelectionId: s.SelectionId,
                })
                    .pipe(Effect.catchTag("ResourceNotFoundException", () => Effect.void))
                : Effect.void, { discard: true });
            yield* backup
                .deleteBackupPlan({ BackupPlanId: output.backupPlanId })
                .pipe(Effect.catchTag("ResourceNotFoundException", () => Effect.void), 
            // Selection deletion is eventually consistent; the plan delete
            // rejects with InvalidRequestException until it settles.
            Effect.retry({
                while: (e) => e._tag === "InvalidRequestException",
                schedule: Schedule.max([
                    Schedule.fixed("3 seconds"),
                    Schedule.recurs(10),
                ]),
            }));
        }),
    });
}));
//# sourceMappingURL=BackupPlan.js.map