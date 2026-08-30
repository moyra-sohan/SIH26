import * as codedeploy from "@distilled.cloud/aws/codedeploy";
import * as Layer from "effect/Layer";
import { makeCodeDeployGroupHttpBinding } from "./BindingHttp.js";
import { ContinueDeployment } from "./ContinueDeployment.js";
export const ContinueDeploymentHttp = Layer.effect(ContinueDeployment, makeCodeDeployGroupHttpBinding({
    tag: "AWS.CodeDeploy.ContinueDeployment",
    operation: codedeploy.continueDeployment,
    actions: ["codedeploy:ContinueDeployment"],
}));
//# sourceMappingURL=ContinueDeploymentHttp.js.map