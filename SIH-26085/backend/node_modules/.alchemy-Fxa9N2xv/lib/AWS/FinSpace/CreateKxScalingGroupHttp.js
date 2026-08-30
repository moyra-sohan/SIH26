import * as finspace from "@distilled.cloud/aws/finspace";
import * as Layer from "effect/Layer";
import { makeFinSpaceKxHttpBinding } from "./BindingHttp.js";
import { CreateKxScalingGroup } from "./CreateKxScalingGroup.js";
export const CreateKxScalingGroupHttp = Layer.effect(CreateKxScalingGroup, makeFinSpaceKxHttpBinding({
    tag: "AWS.FinSpace.CreateKxScalingGroup",
    operation: finspace.createKxScalingGroup,
    actions: ["finspace:CreateKxScalingGroup"],
}));
//# sourceMappingURL=CreateKxScalingGroupHttp.js.map