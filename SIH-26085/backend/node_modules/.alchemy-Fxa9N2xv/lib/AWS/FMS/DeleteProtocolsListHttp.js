import * as fms from "@distilled.cloud/aws/fms";
import * as Layer from "effect/Layer";
import { makeFmsHttpBinding } from "./BindingHttp.js";
import { DeleteProtocolsList } from "./DeleteProtocolsList.js";
export const DeleteProtocolsListHttp = Layer.effect(DeleteProtocolsList, makeFmsHttpBinding({
    capability: "DeleteProtocolsList",
    iamActions: ["fms:DeleteProtocolsList"],
    operation: fms.deleteProtocolsList,
}));
//# sourceMappingURL=DeleteProtocolsListHttp.js.map