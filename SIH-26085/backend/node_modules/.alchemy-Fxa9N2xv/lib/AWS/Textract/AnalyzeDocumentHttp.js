import * as textract from "@distilled.cloud/aws/textract";
import * as Layer from "effect/Layer";
import { makeTextractHttpBinding } from "./BindingHttp.js";
import { AnalyzeDocument } from "./AnalyzeDocument.js";
export const AnalyzeDocumentHttp = Layer.effect(AnalyzeDocument, makeTextractHttpBinding({
    capability: "AnalyzeDocument",
    // No resource-level IAM for this action.
    iamActions: ["textract:AnalyzeDocument"],
    operation: textract.analyzeDocument,
}));
//# sourceMappingURL=AnalyzeDocumentHttp.js.map