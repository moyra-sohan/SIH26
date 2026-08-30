import * as docdbelastic from "@distilled.cloud/aws/docdb-elastic";
import * as Layer from "effect/Layer";
import { makeDocDBElasticAccountHttpBinding } from "./BindingHttp.js";
import { ApplyPendingMaintenanceAction } from "./ApplyPendingMaintenanceAction.js";
export const ApplyPendingMaintenanceActionHttp = Layer.effect(ApplyPendingMaintenanceAction, makeDocDBElasticAccountHttpBinding({
    tag: "AWS.DocDBElastic.ApplyPendingMaintenanceAction",
    operation: docdbelastic.applyPendingMaintenanceAction,
    actions: ["docdb-elastic:ApplyPendingMaintenanceAction"],
}));
//# sourceMappingURL=ApplyPendingMaintenanceActionHttp.js.map