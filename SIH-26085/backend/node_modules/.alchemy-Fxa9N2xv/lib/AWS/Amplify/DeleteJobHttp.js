import * as amplify from "@distilled.cloud/aws/amplify";
import * as Layer from "effect/Layer";
import * as Output from "../../Output.js";
import { makeAmplifyHttpBinding } from "./BindingHttp.js";
import { DeleteJob } from "./DeleteJob.js";
export const DeleteJobHttp = Layer.effect(DeleteJob, makeAmplifyHttpBinding({
    name: "DeleteJob",
    operation: amplify.deleteJob,
    actions: ["amplify:DeleteJob"],
    resources: (app) => [Output.interpolate `${app.appArn}/branches/*/jobs/*`],
}));
//# sourceMappingURL=DeleteJobHttp.js.map