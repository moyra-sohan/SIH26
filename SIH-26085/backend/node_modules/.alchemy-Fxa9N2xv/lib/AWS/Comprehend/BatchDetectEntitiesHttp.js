import * as comprehend from "@distilled.cloud/aws/comprehend";
import * as Layer from "effect/Layer";
import { makeComprehendHttpBinding } from "./BindingHttp.js";
import { BatchDetectEntities } from "./BatchDetectEntities.js";
export const BatchDetectEntitiesHttp = Layer.effect(BatchDetectEntities, makeComprehendHttpBinding({
    tag: "AWS.Comprehend.BatchDetectEntities",
    operation: comprehend.batchDetectEntities,
    actions: ["comprehend:BatchDetectEntities"],
}));
//# sourceMappingURL=BatchDetectEntitiesHttp.js.map