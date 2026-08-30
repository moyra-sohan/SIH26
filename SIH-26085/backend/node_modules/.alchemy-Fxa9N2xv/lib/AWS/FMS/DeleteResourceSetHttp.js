import * as fms from "@distilled.cloud/aws/fms";
import * as Layer from "effect/Layer";
import { makeFmsHttpBinding } from "./BindingHttp.js";
import { DeleteResourceSet } from "./DeleteResourceSet.js";
export const DeleteResourceSetHttp = Layer.effect(DeleteResourceSet, makeFmsHttpBinding({
    capability: "DeleteResourceSet",
    iamActions: ["fms:DeleteResourceSet"],
    operation: fms.deleteResourceSet,
}));
//# sourceMappingURL=DeleteResourceSetHttp.js.map