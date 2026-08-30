import * as inspector2 from "@distilled.cloud/aws/inspector2";
import * as Layer from "effect/Layer";
import { makeInspector2AccountHttpBinding } from "./BindingHttp.js";
import { BatchGetCodeSnippet } from "./BatchGetCodeSnippet.js";
export const BatchGetCodeSnippetHttp = Layer.effect(BatchGetCodeSnippet, makeInspector2AccountHttpBinding({
    tag: "AWS.Inspector2.BatchGetCodeSnippet",
    operation: inspector2.batchGetCodeSnippet,
    actions: ["inspector2:BatchGetCodeSnippet"],
}));
//# sourceMappingURL=BatchGetCodeSnippetHttp.js.map