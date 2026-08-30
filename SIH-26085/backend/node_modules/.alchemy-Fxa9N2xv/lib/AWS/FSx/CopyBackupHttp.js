import * as fsx from "@distilled.cloud/aws/fsx";
import * as Layer from "effect/Layer";
import { makeFSxAccountHttpBinding } from "./BindingHttp.js";
import { CopyBackup } from "./CopyBackup.js";
export const CopyBackupHttp = Layer.effect(CopyBackup, makeFSxAccountHttpBinding({
    tag: "AWS.FSx.CopyBackup",
    // CopyBackup tags the new backup it creates, so it needs TagResource
    // alongside the copy itself.
    operation: fsx.copyBackup,
    actions: ["fsx:CopyBackup", "fsx:TagResource"],
}));
//# sourceMappingURL=CopyBackupHttp.js.map