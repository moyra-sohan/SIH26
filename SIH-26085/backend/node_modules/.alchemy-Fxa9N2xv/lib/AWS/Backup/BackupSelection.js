import * as backup from "@distilled.cloud/aws/backup";
import * as Effect from "effect/Effect";
import * as Schedule from "effect/Schedule";
import { isResolved } from "../../Diff.js";
import { createPhysicalName } from "../../PhysicalName.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
/**
 * An AWS Backup selection — assigns AWS resources to a {@link BackupPlan}
 * either by explicit ARN or by matching resource tags, using an IAM role that
 * AWS Backup assumes to perform the backups.
 *
 * A selection is immutable: any change to its name, role, or resource set
 * replaces it.
 *
 * ### Assigning Resources
 * **Example:** Assign resources by tag
 * ```typescript
 * import * as Backup from "alchemy/AWS/Backup";
 *
 * const selection = yield* Backup.BackupSelection("TaggedResources", {
 *   backupPlanId: plan.backupPlanId,
 *   iamRoleArn: backupRole.roleArn,
 *   listOfTags: [
 *     {
 *       conditionType: "STRINGEQUALS",
 *       conditionKey: "aws:ResourceTag/backup",
 *       conditionValue: "daily",
 *     },
 *   ],
 * });
 * ```
 *
 * **Example:** Assign resources by ARN
 * ```typescript
 * const selection = yield* Backup.BackupSelection("ExplicitResources", {
 *   backupPlanId: plan.backupPlanId,
 *   iamRoleArn: backupRole.roleArn,
 *   resources: [table.tableArn],
 * });
 * ```
 *
 * @resource
 */
export const BackupSelection = Resource("AWS.Backup.BackupSelection");
// A freshly-created IAM role is not immediately assumable by AWS Backup, so
// CreateBackupSelection can transiently reject the role with
// InvalidParameterValueException. Retry on a bounded schedule. The explicit
// return annotation keeps `Retry.Return`'s conditional type out of the
// provider's declaration emit (see SecretsManager/Secret.ts).
const retryRolePropagation = (eff) => eff.pipe(Effect.retry({
    while: (e) => e._tag === "InvalidParameterValueException",
    schedule: Schedule.max([
        Schedule.fixed("3 seconds"),
        Schedule.recurs(10),
    ]),
}));
export const BackupSelectionProvider = () => Provider.effect(BackupSelection, Effect.gen(function* () {
    const createName = Effect.fn(function* (id, props) {
        return (props.selectionName ??
            (yield* createPhysicalName({ id, maxLength: 50 })));
    });
    return BackupSelection.Provider.of({
        stables: ["selectionId", "selectionName", "backupPlanId"],
        // A selection is keyed by its parent plan; there is no account-wide
        // enumeration API. Return empty and rely on read/reconcile by id.
        list: () => Effect.succeed([]),
        read: Effect.fn(function* ({ output }) {
            if (!output?.selectionId || !output?.backupPlanId)
                return undefined;
            // AWS Backup returns InvalidParameterValueException (not
            // ResourceNotFoundException) for a selection id that no longer
            // exists — treat both as "absent".
            const found = yield* backup
                .getBackupSelection({
                BackupPlanId: output.backupPlanId,
                SelectionId: output.selectionId,
            })
                .pipe(Effect.catchTag(["ResourceNotFoundException", "InvalidParameterValueException"], () => Effect.succeed(undefined)));
            if (!found?.SelectionId)
                return undefined;
            return {
                selectionId: found.SelectionId,
                selectionName: found.BackupSelection?.SelectionName ?? output.selectionName,
                backupPlanId: output.backupPlanId,
            };
        }),
        diff: Effect.fn(function* ({ id, news, olds }) {
            if (!isResolved(news))
                return undefined;
            const oldName = yield* createName(id, olds);
            const newName = yield* createName(id, news);
            // The selection API has no update operation, so every meaningful
            // change is a replacement.
            if (oldName !== newName ||
                (olds.backupPlanId ?? "") !== (news.backupPlanId ?? "") ||
                (olds.iamRoleArn ?? "") !== (news.iamRoleArn ?? "") ||
                JSON.stringify(olds.resources ?? []) !==
                    JSON.stringify(news.resources ?? []) ||
                JSON.stringify(olds.notResources ?? []) !==
                    JSON.stringify(news.notResources ?? []) ||
                JSON.stringify(olds.listOfTags ?? []) !==
                    JSON.stringify(news.listOfTags ?? [])) {
                return { action: "replace" };
            }
        }),
        reconcile: Effect.fn(function* ({ id, news, output, session }) {
            const name = output?.selectionName ?? (yield* createName(id, news));
            const backupPlanId = news.backupPlanId;
            // OBSERVE — confirm an existing selection by id; a selection is
            // immutable so there is nothing to sync when it already exists.
            if (output?.selectionId) {
                const existing = yield* backup
                    .getBackupSelection({
                    BackupPlanId: backupPlanId,
                    SelectionId: output.selectionId,
                })
                    .pipe(Effect.catchTag([
                    "ResourceNotFoundException",
                    "InvalidParameterValueException",
                ], () => Effect.succeed(undefined)));
                if (existing?.SelectionId) {
                    yield* session.note(existing.SelectionId);
                    return {
                        selectionId: existing.SelectionId,
                        selectionName: name,
                        backupPlanId,
                    };
                }
            }
            // ENSURE — create (retrying while the IAM role propagates).
            const created = yield* retryRolePropagation(backup.createBackupSelection({
                BackupPlanId: backupPlanId,
                BackupSelection: {
                    SelectionName: name,
                    IamRoleArn: news.iamRoleArn,
                    Resources: news.resources,
                    NotResources: news.notResources,
                    ListOfTags: news.listOfTags?.map((c) => ({
                        ConditionType: c.conditionType ?? "STRINGEQUALS",
                        ConditionKey: c.conditionKey,
                        ConditionValue: c.conditionValue,
                    })),
                },
            }));
            yield* session.note(created.SelectionId);
            return {
                selectionId: created.SelectionId,
                selectionName: name,
                backupPlanId,
            };
        }),
        delete: Effect.fn(function* ({ output }) {
            // A missing selection deletes as InvalidParameterValueException; a
            // deleted parent plan yields ResourceNotFoundException. Both are
            // "already gone".
            yield* backup
                .deleteBackupSelection({
                BackupPlanId: output.backupPlanId,
                SelectionId: output.selectionId,
            })
                .pipe(Effect.catchTag(["ResourceNotFoundException", "InvalidParameterValueException"], () => Effect.void));
        }),
    });
}));
//# sourceMappingURL=BackupSelection.js.map