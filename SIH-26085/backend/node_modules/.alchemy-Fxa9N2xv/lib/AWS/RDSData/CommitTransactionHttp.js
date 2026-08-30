import * as rdsdata from "@distilled.cloud/aws/rds-data";
import * as Layer from "effect/Layer";
import { makeRDSDataHttpBinding } from "./BindingHttp.js";
import { CommitTransaction, } from "./CommitTransaction.js";
export const CommitTransactionHttp = Layer.effect(CommitTransaction, makeRDSDataHttpBinding({
    tag: "AWS.RDSData.CommitTransaction",
    action: "rds-data:CommitTransaction",
    operation: rdsdata.commitTransaction,
    // commit is transaction-scoped — no database/schema on the wire
    makeInput: (request, { resourceArn, secretArn }) => ({
        ...request,
        resourceArn,
        secretArn,
    }),
}));
//# sourceMappingURL=CommitTransactionHttp.js.map