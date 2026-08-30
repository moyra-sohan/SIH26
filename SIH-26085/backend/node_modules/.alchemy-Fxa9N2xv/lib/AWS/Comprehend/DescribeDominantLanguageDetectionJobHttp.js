import * as comprehend from "@distilled.cloud/aws/comprehend";
import * as Layer from "effect/Layer";
import { makeComprehendHttpBinding } from "./BindingHttp.js";
import { DescribeDominantLanguageDetectionJob } from "./DescribeDominantLanguageDetectionJob.js";
export const DescribeDominantLanguageDetectionJobHttp = Layer.effect(DescribeDominantLanguageDetectionJob, makeComprehendHttpBinding({
    tag: "AWS.Comprehend.DescribeDominantLanguageDetectionJob",
    operation: comprehend.describeDominantLanguageDetectionJob,
    actions: ["comprehend:DescribeDominantLanguageDetectionJob"],
}));
//# sourceMappingURL=DescribeDominantLanguageDetectionJobHttp.js.map