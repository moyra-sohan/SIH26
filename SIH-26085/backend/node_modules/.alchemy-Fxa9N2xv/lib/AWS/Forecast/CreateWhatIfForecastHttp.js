import * as forecast from "@distilled.cloud/aws/forecast";
import * as Layer from "effect/Layer";
import { makeForecastHttpBinding } from "./BindingHttp.js";
import { CreateWhatIfForecast } from "./CreateWhatIfForecast.js";
export const CreateWhatIfForecastHttp = Layer.effect(CreateWhatIfForecast, makeForecastHttpBinding({
    capability: "CreateWhatIfForecast",
    iamActions: ["forecast:CreateWhatIfForecast"],
    operation: forecast.createWhatIfForecast,
    // TimeSeriesReplacementsDataSource hands Forecast a role to read S3.
    passRole: true,
}));
//# sourceMappingURL=CreateWhatIfForecastHttp.js.map