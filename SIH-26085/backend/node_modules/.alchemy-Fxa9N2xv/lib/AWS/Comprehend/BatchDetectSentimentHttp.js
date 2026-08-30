import * as comprehend from "@distilled.cloud/aws/comprehend";
import * as Layer from "effect/Layer";
import { makeComprehendHttpBinding } from "./BindingHttp.js";
import { BatchDetectSentiment } from "./BatchDetectSentiment.js";
export const BatchDetectSentimentHttp = Layer.effect(BatchDetectSentiment, makeComprehendHttpBinding({
    tag: "AWS.Comprehend.BatchDetectSentiment",
    operation: comprehend.batchDetectSentiment,
    actions: ["comprehend:BatchDetectSentiment"],
}));
//# sourceMappingURL=BatchDetectSentimentHttp.js.map