import * as geoRoutes from "@distilled.cloud/aws/geo-routes";
import * as Layer from "effect/Layer";
import { makeGeoRoutesHttpBinding } from "./BindingHttp.js";
import { CalculateIsolines } from "./CalculateIsolines.js";
export const CalculateIsolinesHttp = Layer.effect(CalculateIsolines, makeGeoRoutesHttpBinding({
    capability: "CalculateIsolines",
    iamActions: ["geo-routes:CalculateIsolines"],
    operation: geoRoutes.calculateIsolines,
}));
//# sourceMappingURL=CalculateIsolinesHttp.js.map