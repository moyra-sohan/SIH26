import * as entityresolution from "@distilled.cloud/aws/entityresolution";
import * as Layer from "effect/Layer";
import { makeWorkflowHttpBinding } from "./BindingHttp.js";
import { BatchDeleteUniqueId } from "./BatchDeleteUniqueId.js";
export const BatchDeleteUniqueIdHttp = Layer.effect(BatchDeleteUniqueId, makeWorkflowHttpBinding({
    tag: "AWS.EntityResolution.BatchDeleteUniqueId",
    operation: entityresolution.batchDeleteUniqueId,
    actions: ["entityresolution:BatchDeleteUniqueId"],
}));
//# sourceMappingURL=BatchDeleteUniqueIdHttp.js.map