import * as personalize from "@distilled.cloud/aws/personalize";
import * as Layer from "effect/Layer";
import { makePersonalizeAccountHttpBinding } from "./BindingHttp.js";
import { CreateDatasetImportJob } from "./CreateDatasetImportJob.js";
export const CreateDatasetImportJobHttp = Layer.effect(CreateDatasetImportJob, makePersonalizeAccountHttpBinding({
    tag: "AWS.Personalize.CreateDatasetImportJob",
    operation: personalize.createDatasetImportJob,
    actions: ["personalize:CreateDatasetImportJob"],
    passRole: true,
}));
//# sourceMappingURL=CreateDatasetImportJobHttp.js.map