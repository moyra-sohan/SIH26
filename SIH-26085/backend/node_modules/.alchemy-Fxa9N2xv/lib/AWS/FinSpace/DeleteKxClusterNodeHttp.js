import * as finspace from "@distilled.cloud/aws/finspace";
import * as Layer from "effect/Layer";
import { makeFinSpaceKxHttpBinding } from "./BindingHttp.js";
import { DeleteKxClusterNode } from "./DeleteKxClusterNode.js";
export const DeleteKxClusterNodeHttp = Layer.effect(DeleteKxClusterNode, makeFinSpaceKxHttpBinding({
    tag: "AWS.FinSpace.DeleteKxClusterNode",
    operation: finspace.deleteKxClusterNode,
    actions: ["finspace:DeleteKxClusterNode"],
}));
//# sourceMappingURL=DeleteKxClusterNodeHttp.js.map