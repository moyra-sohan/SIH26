import * as comprehendmedical from "@distilled.cloud/aws/comprehendmedical";
import * as Layer from "effect/Layer";
import { makeComprehendMedicalHttpBinding } from "./BindingHttp.js";
import { DescribeICD10CMInferenceJob } from "./DescribeICD10CMInferenceJob.js";
export const DescribeICD10CMInferenceJobHttp = Layer.effect(DescribeICD10CMInferenceJob, makeComprehendMedicalHttpBinding({
    capability: "DescribeICD10CMInferenceJob",
    iamActions: ["comprehendmedical:DescribeICD10CMInferenceJob"],
    operation: comprehendmedical.describeICD10CMInferenceJob,
}));
//# sourceMappingURL=DescribeICD10CMInferenceJobHttp.js.map