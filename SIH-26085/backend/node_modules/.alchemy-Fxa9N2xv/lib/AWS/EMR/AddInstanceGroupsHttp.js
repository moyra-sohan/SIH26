import * as emr from "@distilled.cloud/aws/emr";
import * as Layer from "effect/Layer";
import { makeEmrClusterHttpBinding } from "./BindingHttp.js";
import { AddInstanceGroups } from "./AddInstanceGroups.js";
export const AddInstanceGroupsHttp = Layer.effect(AddInstanceGroups, makeEmrClusterHttpBinding({
    tag: "AWS.EMR.AddInstanceGroups",
    operation: emr.addInstanceGroups,
    actions: ["elasticmapreduce:AddInstanceGroups"],
    inject: "JobFlowId",
}));
//# sourceMappingURL=AddInstanceGroupsHttp.js.map