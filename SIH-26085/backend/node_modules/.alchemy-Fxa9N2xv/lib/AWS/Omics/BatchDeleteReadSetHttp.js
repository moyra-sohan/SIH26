import * as omics from "@distilled.cloud/aws/omics";
import * as Layer from "effect/Layer";
import { makeOmicsResourceHttpBinding } from "./BindingHttp.js";
import { BatchDeleteReadSet } from "./BatchDeleteReadSet.js";
export const BatchDeleteReadSetHttp = Layer.effect(BatchDeleteReadSet, makeOmicsResourceHttpBinding({
    tag: "AWS.Omics.BatchDeleteReadSet",
    operation: omics.batchDeleteReadSet,
    actions: ["omics:BatchDeleteReadSet"],
    key: "sequenceStoreId",
    id: (store) => store.sequenceStoreId,
    arn: (store) => store.sequenceStoreArn,
}));
//# sourceMappingURL=BatchDeleteReadSetHttp.js.map