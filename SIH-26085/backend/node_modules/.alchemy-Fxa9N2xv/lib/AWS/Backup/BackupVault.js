import * as backup from "@distilled.cloud/aws/backup";
import * as Effect from "effect/Effect";
import * as Schedule from "effect/Schedule";
import * as Stream from "effect/Stream";
import { Unowned } from "../../AdoptPolicy.js";
import { isResolved } from "../../Diff.js";
import { createPhysicalName } from "../../PhysicalName.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
import { createInternalTags, diffTags, hasAlchemyTags } from "../../Tags.js";
import { normalizePolicyDocument, stringifyPolicyDocument, } from "../IAM/Policy.js";
/**
 * An AWS Backup vault — a logical container that stores and organizes
 * recovery points created by backup jobs.
 *
 * A vault name is auto-generated from the app, stage, and logical ID unless
 * you provide one explicitly. Recovery points can optionally be encrypted
 * with a customer-managed KMS key, and access to the vault can be restricted
 * with a resource-based policy.
 *
 * ### Creating a Vault
 * **Example:** Basic Vault
 * ```typescript
 * import * as Backup from "alchemy/AWS/Backup";
 *
 * const vault = yield* Backup.BackupVault("AppBackups");
 * ```
 *
 * **Example:** Vault with a Customer-Managed KMS Key
 * ```typescript
 * const vault = yield* Backup.BackupVault("EncryptedBackups", {
 *   encryptionKeyArn: key.keyArn,
 * });
 * ```
 *
 * ### Vault Access Policy
 * **Example:** Deny deletion of recovery points
 * ```typescript
 * const vault = yield* Backup.BackupVault("LockedBackups", {
 *   accessPolicy: {
 *     Version: "2012-10-17",
 *     Statement: [
 *       {
 *         Effect: "Deny",
 *         Principal: { AWS: "*" },
 *         Action: ["backup:DeleteRecoveryPoint"],
 *         Resource: "*",
 *       },
 *     ],
 *   },
 * });
 * ```
 *
 * @resource
 */
export const BackupVault = Resource("AWS.Backup.BackupVault");
const toPolicyString = (policy) => policy === undefined
    ? undefined
    : typeof policy === "string"
        ? policy
        : stringifyPolicyDocument(policy);
export const BackupVaultProvider = () => Provider.effect(BackupVault, Effect.gen(function* () {
    const createName = Effect.fn(function* (id, props) {
        return (props.backupVaultName ??
            (yield* createPhysicalName({ id, maxLength: 50 })));
    });
    return BackupVault.Provider.of({
        stables: ["backupVaultName", "backupVaultArn"],
        list: () => backup.listBackupVaults.pages({}).pipe(Stream.runCollect, Effect.map((chunk) => Array.from(chunk)
            .flatMap((page) => page.BackupVaultList ?? [])
            .filter((v) => v.BackupVaultName !== undefined &&
            v.BackupVaultArn !== undefined &&
            // Service-managed vaults (e.g. EFS automatic backups'
            // `aws/efs/automatic-backup-vault`) reject
            // DeleteBackupVault with a 403 even when empty (verified
            // live) — keep them out of enumeration for account-wide
            // teardown (nuke).
            !v.BackupVaultName.startsWith("aws/"))
            .map((v) => ({
            backupVaultName: v.BackupVaultName,
            backupVaultArn: v.BackupVaultArn,
        })))),
        read: Effect.fn(function* ({ id, olds, output }) {
            const name = output?.backupVaultName ?? (yield* createName(id, olds ?? {}));
            // AWS Backup returns AccessDeniedException (with an empty message),
            // not ResourceNotFoundException, when a vault does not exist — it
            // hides existence behind a 403. Treat both as "absent".
            const found = yield* backup
                .describeBackupVault({ BackupVaultName: name })
                .pipe(Effect.catchTag(["ResourceNotFoundException", "AccessDeniedException"], () => Effect.succeed(undefined)));
            if (!found?.BackupVaultArn)
                return undefined;
            const attrs = {
                backupVaultName: name,
                backupVaultArn: found.BackupVaultArn,
            };
            const tags = yield* backup
                .listTags({ ResourceArn: found.BackupVaultArn })
                .pipe(Effect.map((r) => r.Tags ?? {}), Effect.catch(() => Effect.succeed({})));
            return (yield* hasAlchemyTags(id, tags))
                ? attrs
                : Unowned(attrs);
        }),
        diff: Effect.fn(function* ({ id, news = {}, olds = {} }) {
            if (!isResolved(news))
                return undefined;
            const oldName = yield* createName(id, olds);
            const newName = yield* createName(id, news);
            if (oldName !== newName)
                return { action: "replace" };
            if ((olds.encryptionKeyArn ?? "") !== (news.encryptionKeyArn ?? "")) {
                return { action: "replace" };
            }
        }),
        reconcile: Effect.fn(function* ({ id, news = {}, output, session }) {
            const name = output?.backupVaultName ?? (yield* createName(id, news));
            const internalTags = yield* createInternalTags(id);
            // OBSERVE — cloud state is authoritative; output is only an id cache.
            // A missing vault surfaces as AccessDeniedException (see read()).
            let live = yield* backup
                .describeBackupVault({ BackupVaultName: name })
                .pipe(Effect.catchTag(["ResourceNotFoundException", "AccessDeniedException"], () => Effect.succeed(undefined)));
            // ENSURE — create if missing; tolerate an AlreadyExists race.
            if (!live?.BackupVaultArn) {
                live = yield* backup
                    .createBackupVault({
                    BackupVaultName: name,
                    EncryptionKeyArn: news.encryptionKeyArn,
                    BackupVaultTags: { ...internalTags, ...news.tags },
                })
                    .pipe(Effect.catchTag("AlreadyExistsException", () => backup.describeBackupVault({ BackupVaultName: name })));
            }
            const backupVaultArn = live.BackupVaultArn;
            // SYNC access policy — diff observed against desired, comparing
            // canonicalized documents so a re-deploy of an equivalent policy
            // (key order, whitespace) is a no-op.
            const desiredPolicy = toPolicyString(news.accessPolicy);
            const currentPolicy = yield* backup
                .getBackupVaultAccessPolicy({ BackupVaultName: name })
                .pipe(Effect.map((r) => (r.Policy ? r.Policy : undefined)), Effect.catchTag("ResourceNotFoundException", () => Effect.succeed(undefined)));
            const policyDrifted = desiredPolicy === undefined || currentPolicy === undefined
                ? desiredPolicy !== currentPolicy
                : normalizePolicyDocument(currentPolicy) !==
                    normalizePolicyDocument(desiredPolicy);
            if (policyDrifted) {
                if (desiredPolicy === undefined) {
                    yield* backup
                        .deleteBackupVaultAccessPolicy({ BackupVaultName: name })
                        .pipe(Effect.catchTag("ResourceNotFoundException", () => Effect.void));
                }
                else {
                    yield* backup.putBackupVaultAccessPolicy({
                        BackupVaultName: name,
                        Policy: desiredPolicy,
                    });
                }
            }
            // SYNC tags — diff against observed cloud tags.
            const currentTags = yield* backup
                .listTags({ ResourceArn: backupVaultArn })
                .pipe(Effect.map((r) => r.Tags ?? {}), Effect.catch(() => Effect.succeed({})));
            const { upsert, removed } = diffTags(currentTags, { ...news.tags, ...internalTags });
            if (upsert.length > 0) {
                yield* backup.tagResource({
                    ResourceArn: backupVaultArn,
                    Tags: Object.fromEntries(upsert.map((t) => [t.Key, t.Value])),
                });
            }
            if (removed.length > 0) {
                yield* backup.untagResource({
                    ResourceArn: backupVaultArn,
                    TagKeyList: removed,
                });
            }
            yield* session.note(backupVaultArn);
            return { backupVaultName: name, backupVaultArn };
        }),
        delete: Effect.fn(function* ({ output }) {
            // A vault can only be deleted when it is empty — delete any
            // remaining recovery points first. Each delete tolerates the point
            // already being gone or being in a state that can't be deleted
            // right now (EXPIRED/continuous points settle on their own).
            const recoveryPoints = yield* backup.listRecoveryPointsByBackupVault
                .pages({ BackupVaultName: output.backupVaultName })
                .pipe(Stream.runCollect, Effect.map((chunk) => Array.from(chunk).flatMap((page) => page.RecoveryPoints ?? [])), Effect.catchTag(["ResourceNotFoundException", "AccessDeniedException"], () => Effect.succeed([])));
            yield* Effect.forEach(recoveryPoints, (rp) => rp.RecoveryPointArn
                ? backup
                    .deleteRecoveryPoint({
                    BackupVaultName: output.backupVaultName,
                    RecoveryPointArn: rp.RecoveryPointArn,
                })
                    .pipe(Effect.catchTag([
                    "ResourceNotFoundException",
                    "InvalidResourceStateException",
                ], () => Effect.void))
                : Effect.void, { discard: true });
            // A missing vault deletes as AccessDeniedException, not
            // ResourceNotFoundException — both mean "already gone" here.
            yield* backup
                .deleteBackupVault({ BackupVaultName: output.backupVaultName })
                .pipe(Effect.catchTag(["ResourceNotFoundException", "AccessDeniedException"], () => Effect.void), 
            // Recovery-point deletion is asynchronous; the vault delete
            // rejects with InvalidRequestException until the vault empties.
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
//# sourceMappingURL=BackupVault.js.map