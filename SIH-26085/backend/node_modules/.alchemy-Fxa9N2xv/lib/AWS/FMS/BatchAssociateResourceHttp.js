import * as fms from "@distilled.cloud/aws/fms";
import * as Layer from "effect/Layer";
import { makeFmsHttpBinding } from "./BindingHttp.js";
import { BatchAssociateResource } from "./BatchAssociateResource.js";
export const BatchAssociateResourceHttp = Layer.effect(BatchAssociateResource, makeFmsHttpBinding({
    capability: "BatchAssociateResource",
    iamActions: ["fms:BatchAssociateResource"],
    operation: fms.batchAssociateResource,
}));
//# sourceMappingURL=BatchAssociateResourceHttp.js.map