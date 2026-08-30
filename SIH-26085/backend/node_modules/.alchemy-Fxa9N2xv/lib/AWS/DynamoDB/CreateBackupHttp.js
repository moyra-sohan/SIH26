import * as DynamoDB from "@distilled.cloud/aws/dynamodb";
import * as Layer from "effect/Layer";
import { makeTableHttpBinding } from "./BindingHttp.js";
import { CreateBackup } from "./CreateBackup.js";
export const CreateBackupHttp = Layer.effect(CreateBackup, makeTableHttpBinding({
    tag: "AWS.DynamoDB.CreateBackup",
    operation: DynamoDB.createBackup,
    actions: ["dynamodb:CreateBackup"],
}));
//# sourceMappingURL=CreateBackupHttp.js.map