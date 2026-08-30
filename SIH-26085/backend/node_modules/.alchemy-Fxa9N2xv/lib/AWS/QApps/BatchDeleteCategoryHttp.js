import * as qapps from "@distilled.cloud/aws/qapps";
import * as Layer from "effect/Layer";
import { makeQAppsInstanceHttpBinding } from "./BindingHttp.js";
import { BatchDeleteCategory } from "./BatchDeleteCategory.js";
export const BatchDeleteCategoryHttp = Layer.effect(BatchDeleteCategory, makeQAppsInstanceHttpBinding({
    capability: "BatchDeleteCategory",
    iamActions: ["qapps:BatchDeleteCategory"],
    operation: qapps.batchDeleteCategory,
}));
//# sourceMappingURL=BatchDeleteCategoryHttp.js.map