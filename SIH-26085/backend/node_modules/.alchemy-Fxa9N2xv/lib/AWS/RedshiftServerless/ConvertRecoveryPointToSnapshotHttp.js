import * as serverless from "@distilled.cloud/aws/redshift-serverless";
import * as Layer from "effect/Layer";
import { makeServerlessAccountHttpBinding } from "./BindingHttp.js";
import { ConvertRecoveryPointToSnapshot } from "./ConvertRecoveryPointToSnapshot.js";
export const ConvertRecoveryPointToSnapshotHttp = Layer.effect(ConvertRecoveryPointToSnapshot, makeServerlessAccountHttpBinding({
    tag: "AWS.RedshiftServerless.ConvertRecoveryPointToSnapshot",
    operation: serverless.convertRecoveryPointToSnapshot,
    actions: [
        "redshift-serverless:ConvertRecoveryPointToSnapshot",
        "redshift-serverless:TagResource",
    ],
}));
//# sourceMappingURL=ConvertRecoveryPointToSnapshotHttp.js.map