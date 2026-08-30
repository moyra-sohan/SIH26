import * as geoRoutes from "@distilled.cloud/aws/geo-routes";
import * as Layer from "effect/Layer";
import { makeGeoRoutesHttpBinding } from "./BindingHttp.js";
import { CalculateRoutes } from "./CalculateRoutes.js";
export const CalculateRoutesHttp = Layer.effect(CalculateRoutes, makeGeoRoutesHttpBinding({
    capability: "CalculateRoutes",
    iamActions: ["geo-routes:CalculateRoutes"],
    operation: geoRoutes.calculateRoutes,
}));
//# sourceMappingURL=CalculateRoutesHttp.js.map