import * as comprehend from "@distilled.cloud/aws/comprehend";
import * as Layer from "effect/Layer";
import { makeComprehendHttpBinding } from "./BindingHttp.js";
import { BatchDetectKeyPhrases } from "./BatchDetectKeyPhrases.js";
export const BatchDetectKeyPhrasesHttp = Layer.effect(BatchDetectKeyPhrases, makeComprehendHttpBinding({
    tag: "AWS.Comprehend.BatchDetectKeyPhrases",
    operation: comprehend.batchDetectKeyPhrases,
    actions: ["comprehend:BatchDetectKeyPhrases"],
}));
//# sourceMappingURL=BatchDetectKeyPhrasesHttp.js.map