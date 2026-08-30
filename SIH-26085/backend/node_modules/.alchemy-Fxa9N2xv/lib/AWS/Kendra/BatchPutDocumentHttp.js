import * as kendra from "@distilled.cloud/aws/kendra";
import * as Layer from "effect/Layer";
import { makeKendraIndexHttpBinding } from "./BindingHttp.js";
import { BatchPutDocument } from "./BatchPutDocument.js";
export const BatchPutDocumentHttp = Layer.effect(BatchPutDocument, makeKendraIndexHttpBinding({
    tag: "AWS.Kendra.BatchPutDocument",
    operation: kendra.batchPutDocument,
    actions: ["kendra:BatchPutDocument"],
}));
//# sourceMappingURL=BatchPutDocumentHttp.js.map