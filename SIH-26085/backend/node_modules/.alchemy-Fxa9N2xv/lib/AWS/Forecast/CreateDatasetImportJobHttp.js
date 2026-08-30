import * as forecast from "@distilled.cloud/aws/forecast";
import * as Layer from "effect/Layer";
import { makeForecastHttpBinding } from "./BindingHttp.js";
import { CreateDatasetImportJob } from "./CreateDatasetImportJob.js";
export const CreateDatasetImportJobHttp = Layer.effect(CreateDatasetImportJob, makeForecastHttpBinding({
    capability: "CreateDatasetImportJob",
    iamActions: ["forecast:CreateDatasetImportJob"],
    operation: forecast.createDatasetImportJob,
    passRole: true,
}));
//# sourceMappingURL=CreateDatasetImportJobHttp.js.map