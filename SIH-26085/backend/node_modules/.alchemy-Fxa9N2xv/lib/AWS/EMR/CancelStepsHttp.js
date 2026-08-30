import * as emr from "@distilled.cloud/aws/emr";
import * as Layer from "effect/Layer";
import { makeEmrClusterHttpBinding } from "./BindingHttp.js";
import { CancelSteps } from "./CancelSteps.js";
export const CancelStepsHttp = Layer.effect(CancelSteps, makeEmrClusterHttpBinding({
    tag: "AWS.EMR.CancelSteps",
    operation: emr.cancelSteps,
    actions: ["elasticmapreduce:CancelSteps"],
}));
//# sourceMappingURL=CancelStepsHttp.js.map