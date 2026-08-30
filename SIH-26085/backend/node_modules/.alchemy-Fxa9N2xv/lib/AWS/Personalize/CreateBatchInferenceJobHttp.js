import * as personalize from "@distilled.cloud/aws/personalize";
import * as Layer from "effect/Layer";
import { makePersonalizeAccountHttpBinding } from "./BindingHttp.js";
import { CreateBatchInferenceJob } from "./CreateBatchInferenceJob.js";
export const CreateBatchInferenceJobHttp = Layer.effect(CreateBatchInferenceJob, makePersonalizeAccountHttpBinding({
    tag: "AWS.Personalize.CreateBatchInferenceJob",
    operation: personalize.createBatchInferenceJob,
    actions: ["personalize:CreateBatchInferenceJob"],
    passRole: true,
}));
//# sourceMappingURL=CreateBatchInferenceJobHttp.js.map