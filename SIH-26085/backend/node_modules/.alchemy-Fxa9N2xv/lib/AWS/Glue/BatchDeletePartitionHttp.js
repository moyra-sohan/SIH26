import * as glue from "@distilled.cloud/aws/glue";
import * as Layer from "effect/Layer";
import { makeGlueTableHttpBinding } from "./BindingHttp.js";
import { BatchDeletePartition } from "./BatchDeletePartition.js";
export const BatchDeletePartitionHttp = Layer.effect(BatchDeletePartition, makeGlueTableHttpBinding({
    tag: "AWS.Glue.BatchDeletePartition",
    operation: glue.batchDeletePartition,
    actions: ["glue:BatchDeletePartition", "glue:DeletePartition"],
    tableNameKey: "TableName",
}));
//# sourceMappingURL=BatchDeletePartitionHttp.js.map