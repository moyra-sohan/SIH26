import * as qapps from "@distilled.cloud/aws/qapps";
import * as Layer from "effect/Layer";
import { makeQAppHttpBinding } from "./BindingHttp.js";
import { CreateLibraryItem } from "./CreateLibraryItem.js";
export const CreateLibraryItemHttp = Layer.effect(CreateLibraryItem, makeQAppHttpBinding({
    capability: "CreateLibraryItem",
    iamActions: ["qapps:CreateLibraryItem"],
    operation: qapps.createLibraryItem,
    injectAppId: true,
}));
//# sourceMappingURL=CreateLibraryItemHttp.js.map