import * as qapps from "@distilled.cloud/aws/qapps";
import * as Layer from "effect/Layer";
import { makeQAppsInstanceHttpBinding } from "./BindingHttp.js";
import { BatchUpdateCategory } from "./BatchUpdateCategory.js";
export const BatchUpdateCategoryHttp = Layer.effect(BatchUpdateCategory, makeQAppsInstanceHttpBinding({
    capability: "BatchUpdateCategory",
    iamActions: ["qapps:BatchUpdateCategory"],
    operation: qapps.batchUpdateCategory,
}));
//# sourceMappingURL=BatchUpdateCategoryHttp.js.map