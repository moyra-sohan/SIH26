import * as emr from "@distilled.cloud/aws/emr";
import * as Layer from "effect/Layer";
import { makeEmrClusterHttpBinding } from "./BindingHttp.js";
import { AddJobFlowSteps } from "./AddJobFlowSteps.js";
export const AddJobFlowStepsHttp = Layer.effect(AddJobFlowSteps, makeEmrClusterHttpBinding({
    tag: "AWS.EMR.AddJobFlowSteps",
    operation: emr.addJobFlowSteps,
    actions: ["elasticmapreduce:AddJobFlowSteps"],
    inject: "JobFlowId",
}));
//# sourceMappingURL=AddJobFlowStepsHttp.js.map