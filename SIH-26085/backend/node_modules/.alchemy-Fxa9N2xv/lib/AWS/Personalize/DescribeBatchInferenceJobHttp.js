import * as personalize from "@distilled.cloud/aws/personalize";
import * as Layer from "effect/Layer";
import { makePersonalizeAccountHttpBinding } from "./BindingHttp.js";
import { DescribeBatchInferenceJob } from "./DescribeBatchInferenceJob.js";
export const DescribeBatchInferenceJobHttp = Layer.effect(DescribeBatchInferenceJob, makePersonalizeAccountHttpBinding({
    tag: "AWS.Personalize.DescribeBatchInferenceJob",
    operation: personalize.describeBatchInferenceJob,
    actions: ["personalize:DescribeBatchInferenceJob"],
}));
//# sourceMappingURL=DescribeBatchInferenceJobHttp.js.map