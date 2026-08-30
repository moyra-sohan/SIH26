import * as comprehendmedical from "@distilled.cloud/aws/comprehendmedical";
import * as Layer from "effect/Layer";
import { makeComprehendMedicalHttpBinding } from "./BindingHttp.js";
import { DescribePHIDetectionJob } from "./DescribePHIDetectionJob.js";
export const DescribePHIDetectionJobHttp = Layer.effect(DescribePHIDetectionJob, makeComprehendMedicalHttpBinding({
    capability: "DescribePHIDetectionJob",
    iamActions: ["comprehendmedical:DescribePHIDetectionJob"],
    operation: comprehendmedical.describePHIDetectionJob,
}));
//# sourceMappingURL=DescribePHIDetectionJobHttp.js.map