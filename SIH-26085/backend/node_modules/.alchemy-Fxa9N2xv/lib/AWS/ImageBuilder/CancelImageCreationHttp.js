import * as imagebuilder from "@distilled.cloud/aws/imagebuilder";
import * as Layer from "effect/Layer";
import { makeImageBuilderAccountHttpBinding } from "./BindingHttp.js";
import { CancelImageCreation } from "./CancelImageCreation.js";
export const CancelImageCreationHttp = Layer.effect(CancelImageCreation, makeImageBuilderAccountHttpBinding({
    tag: "AWS.ImageBuilder.CancelImageCreation",
    operation: imagebuilder.cancelImageCreation,
    actions: ["imagebuilder:CancelImageCreation"],
}));
//# sourceMappingURL=CancelImageCreationHttp.js.map