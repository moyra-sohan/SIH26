import * as comprehend from "@distilled.cloud/aws/comprehend";
import * as Layer from "effect/Layer";
import { makeComprehendHttpBinding } from "./BindingHttp.js";
import { BatchDetectTargetedSentiment } from "./BatchDetectTargetedSentiment.js";
export const BatchDetectTargetedSentimentHttp = Layer.effect(BatchDetectTargetedSentiment, makeComprehendHttpBinding({
    tag: "AWS.Comprehend.BatchDetectTargetedSentiment",
    operation: comprehend.batchDetectTargetedSentiment,
    actions: ["comprehend:BatchDetectTargetedSentiment"],
}));
//# sourceMappingURL=BatchDetectTargetedSentimentHttp.js.map