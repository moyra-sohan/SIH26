import * as finspace from "@distilled.cloud/aws/finspace";
import * as Layer from "effect/Layer";
import { makeFinSpaceKxHttpBinding } from "./BindingHttp.js";
import { DeleteKxDataview } from "./DeleteKxDataview.js";
export const DeleteKxDataviewHttp = Layer.effect(DeleteKxDataview, makeFinSpaceKxHttpBinding({
    tag: "AWS.FinSpace.DeleteKxDataview",
    operation: finspace.deleteKxDataview,
    actions: ["finspace:DeleteKxDataview"],
}));
//# sourceMappingURL=DeleteKxDataviewHttp.js.map