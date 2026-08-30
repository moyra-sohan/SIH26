import * as location from "@distilled.cloud/aws/location";
import * as Layer from "effect/Layer";
import { makeLocationCalculatorHttpBinding } from "./BindingHttp.js";
import { CalculateRoute } from "./CalculateRoute.js";
export const CalculateRouteHttp = Layer.effect(CalculateRoute, makeLocationCalculatorHttpBinding({
    tag: "AWS.Location.CalculateRoute",
    operation: location.calculateRoute,
    actions: ["geo:CalculateRoute"],
}));
//# sourceMappingURL=CalculateRouteHttp.js.map