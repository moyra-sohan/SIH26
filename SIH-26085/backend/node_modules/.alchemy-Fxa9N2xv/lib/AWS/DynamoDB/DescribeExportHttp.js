import * as DynamoDB from "@distilled.cloud/aws/dynamodb";
import * as Layer from "effect/Layer";
import * as Output from "../../Output.js";
import { makeTableIamHttpBinding } from "./BindingHttp.js";
import { DescribeExport } from "./DescribeExport.js";
export const DescribeExportHttp = Layer.effect(DescribeExport, makeTableIamHttpBinding({
    tag: "AWS.DynamoDB.DescribeExport",
    operation: DynamoDB.describeExport,
    actions: ["dynamodb:DescribeExport"],
    resources: (table) => [Output.interpolate `${table.tableArn}/export/*`],
}));
//# sourceMappingURL=DescribeExportHttp.js.map