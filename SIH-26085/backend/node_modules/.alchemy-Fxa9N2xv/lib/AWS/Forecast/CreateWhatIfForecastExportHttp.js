import * as forecast from "@distilled.cloud/aws/forecast";
import * as Layer from "effect/Layer";
import { makeForecastHttpBinding } from "./BindingHttp.js";
import { CreateWhatIfForecastExport } from "./CreateWhatIfForecastExport.js";
export const CreateWhatIfForecastExportHttp = Layer.effect(CreateWhatIfForecastExport, makeForecastHttpBinding({
    capability: "CreateWhatIfForecastExport",
    iamActions: ["forecast:CreateWhatIfForecastExport"],
    operation: forecast.createWhatIfForecastExport,
    // Destination hands Forecast a role to write the export to S3.
    passRole: true,
}));
//# sourceMappingURL=CreateWhatIfForecastExportHttp.js.map