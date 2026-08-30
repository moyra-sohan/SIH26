import * as DynamoDB from "@distilled.cloud/aws/dynamodb";
import * as Layer from "effect/Layer";
import * as Output from "../../Output.js";
import { makeTableIamHttpBinding } from "./BindingHttp.js";
import { DeleteBackup } from "./DeleteBackup.js";
export const DeleteBackupHttp = Layer.effect(DeleteBackup, makeTableIamHttpBinding({
    tag: "AWS.DynamoDB.DeleteBackup",
    operation: DynamoDB.deleteBackup,
    actions: ["dynamodb:DeleteBackup"],
    resources: (table) => [Output.interpolate `${table.tableArn}/backup/*`],
}));
//# sourceMappingURL=DeleteBackupHttp.js.map