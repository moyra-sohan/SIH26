import * as kendra from "@distilled.cloud/aws/kendra";
import * as Layer from "effect/Layer";
import { makeKendraIndexHttpBinding } from "./BindingHttp.js";
import { BatchGetDocumentStatus } from "./BatchGetDocumentStatus.js";
export const BatchGetDocumentStatusHttp = Layer.effect(BatchGetDocumentStatus, makeKendraIndexHttpBinding({
    tag: "AWS.Kendra.BatchGetDocumentStatus",
    operation: kendra.batchGetDocumentStatus,
    actions: ["kendra:BatchGetDocumentStatus"],
}));
//# sourceMappingURL=BatchGetDocumentStatusHttp.js.map