import * as rdsdata from "@distilled.cloud/aws/rds-data";
import * as Layer from "effect/Layer";
import { BatchExecuteStatement, } from "./BatchExecuteStatement.js";
import { makeRDSDataHttpBinding } from "./BindingHttp.js";
export const BatchExecuteStatementHttp = Layer.effect(BatchExecuteStatement, makeRDSDataHttpBinding({
    tag: "AWS.RDSData.BatchExecuteStatement",
    action: "rds-data:BatchExecuteStatement",
    operation: rdsdata.batchExecuteStatement,
    makeInput: (request, { resourceArn, secretArn, database, schema }) => ({
        ...request,
        resourceArn,
        secretArn,
        database,
        schema,
    }),
}));
//# sourceMappingURL=BatchExecuteStatementHttp.js.map