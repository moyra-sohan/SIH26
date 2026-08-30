import * as location from "@distilled.cloud/aws/location";
import * as Layer from "effect/Layer";
import { makeLocationCalculatorHttpBinding } from "./BindingHttp.js";
import { CalculateRouteMatrix } from "./CalculateRouteMatrix.js";
export const CalculateRouteMatrixHttp = Layer.effect(CalculateRouteMatrix, makeLocationCalculatorHttpBinding({
    tag: "AWS.Location.CalculateRouteMatrix",
    operation: location.calculateRouteMatrix,
    actions: ["geo:CalculateRouteMatrix"],
}));
//# sourceMappingURL=CalculateRouteMatrixHttp.js.map