import * as glue from "@distilled.cloud/aws/glue";
import * as Layer from "effect/Layer";
import { makeGlueTableHttpBinding } from "./BindingHttp.js";
import { CreatePartition } from "./CreatePartition.js";
export const CreatePartitionHttp = Layer.effect(CreatePartition, makeGlueTableHttpBinding({
    tag: "AWS.Glue.CreatePartition",
    operation: glue.createPartition,
    actions: ["glue:CreatePartition"],
    tableNameKey: "TableName",
}));
//# sourceMappingURL=CreatePartitionHttp.js.map