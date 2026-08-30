import * as DynamoDB from "@distilled.cloud/aws/dynamodb";
import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
export const sortBatchWriteItemTables = (tables) => [
    ...new Map(tables.map((table) => [table.LogicalId, table])).values(),
].sort((a, b) => a.LogicalId.localeCompare(b.LogicalId));
export const BatchWriteItem = Binding.Service("AWS.DynamoDB.BatchWriteItem");
//# sourceMappingURL=BatchWriteItem.js.map