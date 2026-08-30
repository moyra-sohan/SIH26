import * as forecast from "@distilled.cloud/aws/forecast";
import * as Layer from "effect/Layer";
import { makeForecastHttpBinding } from "./BindingHttp.js";
import { DescribeForecast } from "./DescribeForecast.js";
export const DescribeForecastHttp = Layer.effect(DescribeForecast, makeForecastHttpBinding({
    capability: "DescribeForecast",
    iamActions: ["forecast:DescribeForecast"],
    operation: forecast.describeForecast,
}));
//# sourceMappingURL=DescribeForecastHttp.js.map