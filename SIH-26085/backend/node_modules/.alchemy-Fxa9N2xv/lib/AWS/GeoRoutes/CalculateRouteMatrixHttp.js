import * as geoRoutes from "@distilled.cloud/aws/geo-routes";
import * as Layer from "effect/Layer";
import { makeGeoRoutesHttpBinding } from "./BindingHttp.js";
import { CalculateRouteMatrix } from "./CalculateRouteMatrix.js";
export const CalculateRouteMatrixHttp = Layer.effect(CalculateRouteMatrix, makeGeoRoutesHttpBinding({
    capability: "CalculateRouteMatrix",
    iamActions: ["geo-routes:CalculateRouteMatrix"],
    operation: geoRoutes.calculateRouteMatrix,
}));
//# sourceMappingURL=CalculateRouteMatrixHttp.js.map