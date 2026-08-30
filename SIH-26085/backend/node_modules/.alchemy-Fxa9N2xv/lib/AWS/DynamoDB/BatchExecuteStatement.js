import * as DynamoDB from "@distilled.cloud/aws/dynamodb";
import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
export const sortBatchExecuteStatementTables = (tables) => [
    ...new Map(tables.map((table) => [table.LogicalId, table])).values(),
].sort((a, b) => a.LogicalId.localeCompare(b.LogicalId));
export const BatchExecuteStatement = Binding.Service("AWS.DynamoDB.BatchExecuteStatement");
//# sourceMappingURL=BatchExecuteStatement.js.map