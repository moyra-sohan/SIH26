import * as cloudhsm from "@distilled.cloud/aws/cloudhsm-v2";
import * as Layer from "effect/Layer";
import { makeCloudHsmHttpBinding } from "./BindingHttp.js";
import { DeleteBackup } from "./DeleteBackup.js";
export const DeleteBackupHttp = Layer.effect(DeleteBackup, makeCloudHsmHttpBinding({
    tag: "AWS.CloudHSMV2.DeleteBackup",
    operation: cloudhsm.deleteBackup,
    actions: ["cloudhsm:DeleteBackup"],
}));
//# sourceMappingURL=DeleteBackupHttp.js.map