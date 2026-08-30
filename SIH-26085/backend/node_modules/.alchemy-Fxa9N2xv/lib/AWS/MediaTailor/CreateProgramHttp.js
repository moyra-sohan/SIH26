import * as mediatailor from "@distilled.cloud/aws/mediatailor";
import * as Layer from "effect/Layer";
import { makeMediaTailorHttpBinding } from "./BindingHttp.js";
import { CreateProgram } from "./CreateProgram.js";
export const CreateProgramHttp = Layer.effect(CreateProgram, makeMediaTailorHttpBinding({
    capability: "CreateProgram",
    iamActions: ["mediatailor:CreateProgram"],
    operation: mediatailor.createProgram,
}));
//# sourceMappingURL=CreateProgramHttp.js.map