import * as finspace from "@distilled.cloud/aws/finspace";
import * as Layer from "effect/Layer";
import { makeFinSpaceKxHttpBinding } from "./BindingHttp.js";
import { DeleteKxScalingGroup } from "./DeleteKxScalingGroup.js";
export const DeleteKxScalingGroupHttp = Layer.effect(DeleteKxScalingGroup, makeFinSpaceKxHttpBinding({
    tag: "AWS.FinSpace.DeleteKxScalingGroup",
    operation: finspace.deleteKxScalingGroup,
    actions: ["finspace:DeleteKxScalingGroup"],
}));
//# sourceMappingURL=DeleteKxScalingGroupHttp.js.map