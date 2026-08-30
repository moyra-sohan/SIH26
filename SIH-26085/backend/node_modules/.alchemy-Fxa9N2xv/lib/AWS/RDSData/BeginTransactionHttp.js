import * as rdsdata from "@distilled.cloud/aws/rds-data";
import * as Layer from "effect/Layer";
import { BeginTransaction } from "./BeginTransaction.js";
import { makeRDSDataHttpBinding } from "./BindingHttp.js";
export const BeginTransactionHttp = Layer.effect(BeginTransaction, makeRDSDataHttpBinding({
    tag: "AWS.RDSData.BeginTransaction",
    action: "rds-data:BeginTransaction",
    operation: rdsdata.beginTransaction,
    // the runtime callable takes no request — everything comes from bind time
    makeInput: (_request, { resourceArn, secretArn, database, schema }) => ({
        resourceArn,
        secretArn,
        database,
        schema,
    }),
}));
//# sourceMappingURL=BeginTransactionHttp.js.map