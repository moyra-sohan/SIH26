import * as forecast from "@distilled.cloud/aws/forecast";
import * as Layer from "effect/Layer";
import { makeForecastHttpBinding } from "./BindingHttp.js";
import { DescribeForecastExportJob } from "./DescribeForecastExportJob.js";
export const DescribeForecastExportJobHttp = Layer.effect(DescribeForecastExportJob, makeForecastHttpBinding({
    capability: "DescribeForecastExportJob",
    iamActions: ["forecast:DescribeForecastExportJob"],
    operation: forecast.describeForecastExportJob,
}));
//# sourceMappingURL=DescribeForecastExportJobHttp.js.map