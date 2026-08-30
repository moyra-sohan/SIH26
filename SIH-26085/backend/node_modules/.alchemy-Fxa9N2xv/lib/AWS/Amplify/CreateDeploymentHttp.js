import * as amplify from "@distilled.cloud/aws/amplify";
import * as Layer from "effect/Layer";
import * as Output from "../../Output.js";
import { makeAmplifyHttpBinding } from "./BindingHttp.js";
import { CreateDeployment } from "./CreateDeployment.js";
export const CreateDeploymentHttp = Layer.effect(CreateDeployment, makeAmplifyHttpBinding({
    name: "CreateDeployment",
    operation: amplify.createDeployment,
    actions: ["amplify:CreateDeployment"],
    resources: (app) => [Output.interpolate `${app.appArn}/branches/*`],
}));
//# sourceMappingURL=CreateDeploymentHttp.js.map