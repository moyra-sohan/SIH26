import * as comprehendmedical from "@distilled.cloud/aws/comprehendmedical";
import * as Layer from "effect/Layer";
import { makeComprehendMedicalHttpBinding } from "./BindingHttp.js";
import { DescribeEntitiesDetectionV2Job } from "./DescribeEntitiesDetectionV2Job.js";
export const DescribeEntitiesDetectionV2JobHttp = Layer.effect(DescribeEntitiesDetectionV2Job, makeComprehendMedicalHttpBinding({
    capability: "DescribeEntitiesDetectionV2Job",
    iamActions: ["comprehendmedical:DescribeEntitiesDetectionV2Job"],
    operation: comprehendmedical.describeEntitiesDetectionV2Job,
}));
//# sourceMappingURL=DescribeEntitiesDetectionV2JobHttp.js.map