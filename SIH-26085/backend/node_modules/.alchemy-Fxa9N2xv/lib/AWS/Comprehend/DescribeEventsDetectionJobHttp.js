import * as comprehend from "@distilled.cloud/aws/comprehend";
import * as Layer from "effect/Layer";
import { makeComprehendHttpBinding } from "./BindingHttp.js";
import { DescribeEventsDetectionJob } from "./DescribeEventsDetectionJob.js";
export const DescribeEventsDetectionJobHttp = Layer.effect(DescribeEventsDetectionJob, makeComprehendHttpBinding({
    tag: "AWS.Comprehend.DescribeEventsDetectionJob",
    operation: comprehend.describeEventsDetectionJob,
    actions: ["comprehend:DescribeEventsDetectionJob"],
}));
//# sourceMappingURL=DescribeEventsDetectionJobHttp.js.map