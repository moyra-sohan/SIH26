import * as DynamoDB from "@distilled.cloud/aws/dynamodb";
import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import * as Layer from "effect/Layer";
import { isBindingHost } from "../Lambda/Function.js";
import { BatchWriteItem, sortBatchWriteItemTables, } from "./BatchWriteItem.js";
export const BatchWriteItemHttp = Layer.effect(BatchWriteItem, Effect.gen(function* () {
    const batchWriteItem = yield* DynamoDB.batchWriteItem;
    return Effect.fn(function* (...tables) {
        const sortedTables = sortBatchWriteItemTables(tables);
        const tableNames = new Map(yield* Effect.forEach(sortedTables, (table) => Effect.gen(function* () {
            return [table.LogicalId, yield* table.tableName];
        })));
        const getTableName = Effect.fn(function* (tableId) {
            const TableName = tableNames.get(tableId);
            if (!TableName) {
                return yield* Effect.die(new Error(`BatchWriteItem request references unbound table '${tableId}'`));
            }
            return yield* TableName;
        });
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, AWS.DynamoDB.BatchWriteItem(${sortedTables}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: ["dynamodb:BatchWriteItem"],
                            Resource: sortedTables.map((table) => table.tableArn),
                        },
                    ],
                });
            }
        }
        return Effect.fn(`AWS.DynamoDB.BatchWriteItem(${sortedTables})`)(function* (request) {
            const requestItems = yield* Effect.forEach(Object.entries(request.RequestItems), ([tableId, writes]) => Effect.gen(function* () {
                return [yield* getTableName(tableId), writes];
            }));
            return yield* batchWriteItem({
                ...request,
                RequestItems: Object.fromEntries(requestItems),
            });
        });
    });
}));
//# sourceMappingURL=BatchWriteItemHttp.js.map