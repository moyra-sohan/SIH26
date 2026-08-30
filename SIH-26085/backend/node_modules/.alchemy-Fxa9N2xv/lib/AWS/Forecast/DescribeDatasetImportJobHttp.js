import * as forecast from "@distilled.cloud/aws/forecast";
import * as Layer from "effect/Layer";
import { makeForecastHttpBinding } from "./BindingHttp.js";
import { DescribeDatasetImportJob } from "./DescribeDatasetImportJob.js";
export const DescribeDatasetImportJobHttp = Layer.effect(DescribeDatasetImportJob, makeForecastHttpBinding({
    capability: "DescribeDatasetImportJob",
    iamActions: ["forecast:DescribeDatasetImportJob"],
    operation: forecast.describeDatasetImportJob,
}));
//# sourceMappingURL=DescribeDatasetImportJobHttp.js.map