import * as glue from "@distilled.cloud/aws/glue";
import * as Layer from "effect/Layer";
import { makeGlueTableHttpBinding } from "./BindingHttp.js";
import { BatchUpdatePartition } from "./BatchUpdatePartition.js";
export const BatchUpdatePartitionHttp = Layer.effect(BatchUpdatePartition, makeGlueTableHttpBinding({
    tag: "AWS.Glue.BatchUpdatePartition",
    operation: glue.batchUpdatePartition,
    actions: ["glue:BatchUpdatePartition", "glue:UpdatePartition"],
    tableNameKey: "TableName",
}));
//# sourceMappingURL=BatchUpdatePartitionHttp.js.map