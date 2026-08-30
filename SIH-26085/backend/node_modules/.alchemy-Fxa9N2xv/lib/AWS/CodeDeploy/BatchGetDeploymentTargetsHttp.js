import * as codedeploy from "@distilled.cloud/aws/codedeploy";
import * as Layer from "effect/Layer";
import { BatchGetDeploymentTargets } from "./BatchGetDeploymentTargets.js";
import { makeCodeDeployGroupHttpBinding } from "./BindingHttp.js";
export const BatchGetDeploymentTargetsHttp = Layer.effect(BatchGetDeploymentTargets, makeCodeDeployGroupHttpBinding({
    tag: "AWS.CodeDeploy.BatchGetDeploymentTargets",
    operation: codedeploy.batchGetDeploymentTargets,
    actions: ["codedeploy:BatchGetDeploymentTargets"],
}));
//# sourceMappingURL=BatchGetDeploymentTargetsHttp.js.map