import * as backup from "@distilled.cloud/aws/backup";
import * as Layer from "effect/Layer";
import { makeBackupVaultHttpBinding } from "./BindingHttp.js";
import { DeleteRecoveryPoint } from "./DeleteRecoveryPoint.js";
export const DeleteRecoveryPointHttp = Layer.effect(DeleteRecoveryPoint, makeBackupVaultHttpBinding({
    tag: "AWS.Backup.DeleteRecoveryPoint",
    operation: backup.deleteRecoveryPoint,
    actions: ["backup:DeleteRecoveryPoint"],
    // Recovery-point actions authorize on the recovery point ARN (the
    // underlying resource's snapshot ARN), not the vault ARN.
    wildcardIam: true,
}));
//# sourceMappingURL=DeleteRecoveryPointHttp.js.map