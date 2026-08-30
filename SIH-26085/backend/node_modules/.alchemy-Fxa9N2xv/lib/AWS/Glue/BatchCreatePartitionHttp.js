import * as glue from "@distilled.cloud/aws/glue";
import * as Layer from "effect/Layer";
import { makeGlueTableHttpBinding } from "./BindingHttp.js";
import { BatchCreatePartition } from "./BatchCreatePartition.js";
export const BatchCreatePartitionHttp = Layer.effect(BatchCreatePartition, makeGlueTableHttpBinding({
    tag: "AWS.Glue.BatchCreatePartition",
    operation: glue.batchCreatePartition,
    actions: ["glue:BatchCreatePartition"],
    tableNameKey: "TableName",
}));
//# sourceMappingURL=BatchCreatePartitionHttp.js.map