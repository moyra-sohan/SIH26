import * as comprehend from "@distilled.cloud/aws/comprehend";
import * as Layer from "effect/Layer";
import { makeComprehendHttpBinding } from "./BindingHttp.js";
import { ContainsPiiEntities } from "./ContainsPiiEntities.js";
export const ContainsPiiEntitiesHttp = Layer.effect(ContainsPiiEntities, makeComprehendHttpBinding({
    tag: "AWS.Comprehend.ContainsPiiEntities",
    operation: comprehend.containsPiiEntities,
    actions: ["comprehend:ContainsPiiEntities"],
}));
//# sourceMappingURL=ContainsPiiEntitiesHttp.js.map