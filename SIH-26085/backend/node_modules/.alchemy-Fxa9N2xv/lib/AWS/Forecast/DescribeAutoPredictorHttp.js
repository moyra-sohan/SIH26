import * as forecast from "@distilled.cloud/aws/forecast";
import * as Layer from "effect/Layer";
import { makeForecastHttpBinding } from "./BindingHttp.js";
import { DescribeAutoPredictor } from "./DescribeAutoPredictor.js";
export const DescribeAutoPredictorHttp = Layer.effect(DescribeAutoPredictor, makeForecastHttpBinding({
    capability: "DescribeAutoPredictor",
    iamActions: ["forecast:DescribeAutoPredictor"],
    operation: forecast.describeAutoPredictor,
}));
//# sourceMappingURL=DescribeAutoPredictorHttp.js.map