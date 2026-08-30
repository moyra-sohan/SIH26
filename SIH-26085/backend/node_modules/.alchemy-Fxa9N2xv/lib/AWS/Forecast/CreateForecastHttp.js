import * as forecast from "@distilled.cloud/aws/forecast";
import * as Layer from "effect/Layer";
import { makeForecastHttpBinding } from "./BindingHttp.js";
import { CreateForecast } from "./CreateForecast.js";
export const CreateForecastHttp = Layer.effect(CreateForecast, makeForecastHttpBinding({
    capability: "CreateForecast",
    iamActions: ["forecast:CreateForecast"],
    operation: forecast.createForecast,
}));
//# sourceMappingURL=CreateForecastHttp.js.map