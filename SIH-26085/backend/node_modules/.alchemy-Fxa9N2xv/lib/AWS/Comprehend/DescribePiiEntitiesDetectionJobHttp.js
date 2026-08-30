import * as comprehend from "@distilled.cloud/aws/comprehend";
import * as Layer from "effect/Layer";
import { makeComprehendHttpBinding } from "./BindingHttp.js";
import { DescribePiiEntitiesDetectionJob } from "./DescribePiiEntitiesDetectionJob.js";
export const DescribePiiEntitiesDetectionJobHttp = Layer.effect(DescribePiiEntitiesDetectionJob, makeComprehendHttpBinding({
    tag: "AWS.Comprehend.DescribePiiEntitiesDetectionJob",
    operation: comprehend.describePiiEntitiesDetectionJob,
    actions: ["comprehend:DescribePiiEntitiesDetectionJob"],
}));
//# sourceMappingURL=DescribePiiEntitiesDetectionJobHttp.js.map