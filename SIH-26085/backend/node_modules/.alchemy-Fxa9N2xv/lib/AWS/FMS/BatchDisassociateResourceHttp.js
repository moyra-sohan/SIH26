import * as fms from "@distilled.cloud/aws/fms";
import * as Layer from "effect/Layer";
import { makeFmsHttpBinding } from "./BindingHttp.js";
import { BatchDisassociateResource } from "./BatchDisassociateResource.js";
export const BatchDisassociateResourceHttp = Layer.effect(BatchDisassociateResource, makeFmsHttpBinding({
    capability: "BatchDisassociateResource",
    iamActions: ["fms:BatchDisassociateResource"],
    operation: fms.batchDisassociateResource,
}));
//# sourceMappingURL=BatchDisassociateResourceHttp.js.map