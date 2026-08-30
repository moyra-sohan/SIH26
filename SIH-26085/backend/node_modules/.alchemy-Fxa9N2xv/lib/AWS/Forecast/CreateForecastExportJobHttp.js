import * as forecast from "@distilled.cloud/aws/forecast";
import * as Layer from "effect/Layer";
import { makeForecastHttpBinding } from "./BindingHttp.js";
import { CreateForecastExportJob } from "./CreateForecastExportJob.js";
export const CreateForecastExportJobHttp = Layer.effect(CreateForecastExportJob, makeForecastHttpBinding({
    capability: "CreateForecastExportJob",
    iamActions: ["forecast:CreateForecastExportJob"],
    operation: forecast.createForecastExportJob,
    // Destination hands Forecast a role to write the export to S3.
    passRole: true,
}));
//# sourceMappingURL=CreateForecastExportJobHttp.js.map