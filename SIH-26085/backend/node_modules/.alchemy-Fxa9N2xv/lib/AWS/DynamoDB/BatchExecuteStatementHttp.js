import * as DynamoDB from "@distilled.cloud/aws/dynamodb";
import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import * as Layer from "effect/Layer";
import * as Output from "../../Output.js";
import { isBindingHost } from "../Lambda/Function.js";
import { BatchExecuteStatement, sortBatchExecuteStatementTables, } from "./BatchExecuteStatement.js";
export const BatchExecuteStatementHttp = Layer.effect(BatchExecuteStatement, Effect.gen(function* () {
    const batchExecuteStatement = yield* DynamoDB.batchExecuteStatement;
    return Effect.fn(function* (...tables) {
        const sortedTables = sortBatchExecuteStatementTables(tables);
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, AWS.DynamoDB.BatchExecuteStatement(${sortedTables}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [
                                "dynamodb:PartiQLDelete",
                                "dynamodb:PartiQLInsert",
                                "dynamodb:PartiQLSelect",
                                "dynamodb:PartiQLUpdate",
                            ],
                            Resource: sortedTables.flatMap((table) => [
                                table.tableArn,
                                Output.interpolate `${table.tableArn}/index/*`,
                            ]),
                        },
                    ],
                });
            }
        }
        return Effect.fn(`AWS.DynamoDB.BatchExecuteStatement(${sortedTables})`)(function* (request) {
            return yield* batchExecuteStatement(request);
        });
    });
}));
//# sourceMappingURL=BatchExecuteStatementHttp.js.map