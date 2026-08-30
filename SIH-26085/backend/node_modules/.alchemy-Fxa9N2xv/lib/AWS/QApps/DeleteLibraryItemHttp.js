import * as qapps from "@distilled.cloud/aws/qapps";
import * as Layer from "effect/Layer";
import { makeQAppsInstanceHttpBinding } from "./BindingHttp.js";
import { DeleteLibraryItem } from "./DeleteLibraryItem.js";
export const DeleteLibraryItemHttp = Layer.effect(DeleteLibraryItem, makeQAppsInstanceHttpBinding({
    capability: "DeleteLibraryItem",
    iamActions: ["qapps:DeleteLibraryItem"],
    operation: qapps.deleteLibraryItem,
}));
//# sourceMappingURL=DeleteLibraryItemHttp.js.map