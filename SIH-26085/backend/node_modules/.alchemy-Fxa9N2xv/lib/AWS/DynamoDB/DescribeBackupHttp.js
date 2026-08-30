import * as DynamoDB from "@distilled.cloud/aws/dynamodb";
import * as Layer from "effect/Layer";
import * as Output from "../../Output.js";
import { makeTableIamHttpBinding } from "./BindingHttp.js";
import { DescribeBackup } from "./DescribeBackup.js";
export const DescribeBackupHttp = Layer.effect(DescribeBackup, makeTableIamHttpBinding({
    tag: "AWS.DynamoDB.DescribeBackup",
    operation: DynamoDB.describeBackup,
    actions: ["dynamodb:DescribeBackup"],
    resources: (table) => [Output.interpolate `${table.tableArn}/backup/*`],
}));
//# sourceMappingURL=DescribeBackupHttp.js.map