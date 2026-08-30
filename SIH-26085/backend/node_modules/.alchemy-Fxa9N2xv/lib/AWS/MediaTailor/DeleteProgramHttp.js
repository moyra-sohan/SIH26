import * as mediatailor from "@distilled.cloud/aws/mediatailor";
import * as Layer from "effect/Layer";
import { makeMediaTailorHttpBinding } from "./BindingHttp.js";
import { DeleteProgram } from "./DeleteProgram.js";
export const DeleteProgramHttp = Layer.effect(DeleteProgram, makeMediaTailorHttpBinding({
    capability: "DeleteProgram",
    iamActions: ["mediatailor:DeleteProgram"],
    operation: mediatailor.deleteProgram,
}));
//# sourceMappingURL=DeleteProgramHttp.js.map