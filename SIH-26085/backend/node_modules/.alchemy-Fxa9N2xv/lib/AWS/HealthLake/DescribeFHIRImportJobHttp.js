import * as healthlake from "@distilled.cloud/aws/healthlake";
import * as Layer from "effect/Layer";
import { makeHealthLakeDatastoreHttpBinding } from "./BindingHttp.js";
import { DescribeFHIRImportJob } from "./DescribeFHIRImportJob.js";
export const DescribeFHIRImportJobHttp = Layer.effect(DescribeFHIRImportJob, makeHealthLakeDatastoreHttpBinding({
    tag: "AWS.HealthLake.DescribeFHIRImportJob",
    operation: healthlake.describeFHIRImportJob,
    actions: ["healthlake:DescribeFHIRImportJob"],
}));
//# sourceMappingURL=DescribeFHIRImportJobHttp.js.map