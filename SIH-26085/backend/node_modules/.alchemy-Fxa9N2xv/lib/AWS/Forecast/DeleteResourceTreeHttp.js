import * as forecast from "@distilled.cloud/aws/forecast";
import * as Layer from "effect/Layer";
import { makeForecastHttpBinding } from "./BindingHttp.js";
import { DeleteResourceTree } from "./DeleteResourceTree.js";
export const DeleteResourceTreeHttp = Layer.effect(DeleteResourceTree, makeForecastHttpBinding({
    capability: "DeleteResourceTree",
    iamActions: ["forecast:DeleteResourceTree"],
    operation: forecast.deleteResourceTree,
}));
//# sourceMappingURL=DeleteResourceTreeHttp.js.map