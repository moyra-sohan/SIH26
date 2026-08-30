import * as fms from "@distilled.cloud/aws/fms";
import * as Layer from "effect/Layer";
import { makeFmsHttpBinding } from "./BindingHttp.js";
import { DeleteAppsList } from "./DeleteAppsList.js";
export const DeleteAppsListHttp = Layer.effect(DeleteAppsList, makeFmsHttpBinding({
    capability: "DeleteAppsList",
    iamActions: ["fms:DeleteAppsList"],
    operation: fms.deleteAppsList,
}));
//# sourceMappingURL=DeleteAppsListHttp.js.map