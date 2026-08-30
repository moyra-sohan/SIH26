import * as emr from "@distilled.cloud/aws/emr";
import * as Layer from "effect/Layer";
import { makeEmrClusterHttpBinding } from "./BindingHttp.js";
import { AddInstanceFleet } from "./AddInstanceFleet.js";
export const AddInstanceFleetHttp = Layer.effect(AddInstanceFleet, makeEmrClusterHttpBinding({
    tag: "AWS.EMR.AddInstanceFleet",
    operation: emr.addInstanceFleet,
    actions: ["elasticmapreduce:AddInstanceFleet"],
}));
//# sourceMappingURL=AddInstanceFleetHttp.js.map