import * as comprehend from "@distilled.cloud/aws/comprehend";
import * as Layer from "effect/Layer";
import { makeComprehendHttpBinding } from "./BindingHttp.js";
import { BatchDetectDominantLanguage } from "./BatchDetectDominantLanguage.js";
export const BatchDetectDominantLanguageHttp = Layer.effect(BatchDetectDominantLanguage, makeComprehendHttpBinding({
    tag: "AWS.Comprehend.BatchDetectDominantLanguage",
    operation: comprehend.batchDetectDominantLanguage,
    actions: ["comprehend:BatchDetectDominantLanguage"],
}));
//# sourceMappingURL=BatchDetectDominantLanguageHttp.js.map