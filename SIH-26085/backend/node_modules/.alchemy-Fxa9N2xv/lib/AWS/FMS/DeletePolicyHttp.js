import * as fms from "@distilled.cloud/aws/fms";
import * as Layer from "effect/Layer";
import { makeFmsHttpBinding } from "./BindingHttp.js";
import { DeletePolicy } from "./DeletePolicy.js";
export const DeletePolicyHttp = Layer.effect(DeletePolicy, makeFmsHttpBinding({
    capability: "DeletePolicy",
    iamActions: ["fms:DeletePolicy"],
    operation: fms.deletePolicy,
}));
//# sourceMappingURL=DeletePolicyHttp.js.map