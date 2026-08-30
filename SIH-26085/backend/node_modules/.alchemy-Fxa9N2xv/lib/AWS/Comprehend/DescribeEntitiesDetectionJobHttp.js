import * as comprehend from "@distilled.cloud/aws/comprehend";
import * as Layer from "effect/Layer";
import { makeComprehendHttpBinding } from "./BindingHttp.js";
import { DescribeEntitiesDetectionJob } from "./DescribeEntitiesDetectionJob.js";
export const DescribeEntitiesDetectionJobHttp = Layer.effect(DescribeEntitiesDetectionJob, makeComprehendHttpBinding({
    tag: "AWS.Comprehend.DescribeEntitiesDetectionJob",
    operation: comprehend.describeEntitiesDetectionJob,
    actions: ["comprehend:DescribeEntitiesDetectionJob"],
}));
//# sourceMappingURL=DescribeEntitiesDetectionJobHttp.js.map