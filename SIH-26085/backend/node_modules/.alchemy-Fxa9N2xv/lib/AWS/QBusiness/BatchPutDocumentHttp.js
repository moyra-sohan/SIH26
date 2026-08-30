import * as qbusiness from "@distilled.cloud/aws/qbusiness";
import * as Layer from "effect/Layer";
import { makeQBusinessIndexHttpBinding } from "./BindingHttp.js";
import { BatchPutDocument } from "./BatchPutDocument.js";
export const BatchPutDocumentHttp = Layer.effect(BatchPutDocument, makeQBusinessIndexHttpBinding({
    tag: "AWS.QBusiness.BatchPutDocument",
    operation: qbusiness.batchPutDocument,
    actions: ["qbusiness:BatchPutDocument"],
}));
//# sourceMappingURL=BatchPutDocumentHttp.js.map