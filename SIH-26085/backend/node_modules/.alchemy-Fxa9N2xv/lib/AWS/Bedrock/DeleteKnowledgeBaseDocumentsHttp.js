import * as bedrock from "@distilled.cloud/aws/bedrock-agent";
import * as Layer from "effect/Layer";
import { makeDataSourceScopedHttpBinding } from "./BindingHttp.js";
import { DeleteKnowledgeBaseDocuments } from "./DeleteKnowledgeBaseDocuments.js";
export const DeleteKnowledgeBaseDocumentsHttp = Layer.effect(DeleteKnowledgeBaseDocuments, makeDataSourceScopedHttpBinding({
    tag: "AWS.Bedrock.DeleteKnowledgeBaseDocuments",
    operation: bedrock.deleteKnowledgeBaseDocuments,
    actions: ["bedrock:DeleteKnowledgeBaseDocuments"],
}));
//# sourceMappingURL=DeleteKnowledgeBaseDocumentsHttp.js.map