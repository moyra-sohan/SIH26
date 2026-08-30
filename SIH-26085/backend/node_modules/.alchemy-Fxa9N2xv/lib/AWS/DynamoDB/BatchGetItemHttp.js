import * as DynamoDB from "@distilled.cloud/aws/dynamodb";
import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import * as Layer from "effect/Layer";
import { isBindingHost } from "../Lambda/Function.js";
import { BatchGetItem, } from "./BatchGetItem.js";
export const BatchGetItemHttp = Layer.effect(BatchGetItem, Effect.gen(function* () {
    const batchGetItem = yield* DynamoDB.batchGetItem;
    return Effect.fn(function* (...tables) {
        const sortedTables = sortTables(tables);
        const tableNames = new Map(yield* Effect.forEach(sortedTables, (table) => Effect.gen(function* () {
            return [table.LogicalId, yield* table.tableName];
        })));
        const getTableName = Effect.fn(function* (tableId) {
            const TableName = tableNames.get(tableId);
            if (!TableName) {
                return yield* Effect.die(new Error(`BatchGetItem request references unbound table '${tableId}'`));
            }
            return yield* TableName;
        });
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, AWS.DynamoDB.BatchGetItem(${sortedTables}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: ["dynamodb:BatchGetItem"],
                            Resource: sortedTables.map((table) => table.tableArn),
                        },
                    ],
                });
            }
        }
        return Effect.fn(`AWS.DynamoDB.BatchGetItem(${sortedTables})`)(function* (request) {
            const requestItems = yield* Effect.forEach(Object.entries(request.RequestItems), ([tableId, keys]) => Effect.gen(function* () {
                return [yield* getTableName(tableId), keys];
            }));
            return yield* batchGetItem({
                ...request,
                RequestItems: Object.fromEntries(requestItems),
            });
        });
    });
}));
const sortTables = (tables) => [
    ...new Map(tables.map((table) => [table.LogicalId, table])).values(),
].sort((a, b) => a.LogicalId.localeCompare(b.LogicalId));
//# sourceMappingURL=BatchGetItemHttp.js.map