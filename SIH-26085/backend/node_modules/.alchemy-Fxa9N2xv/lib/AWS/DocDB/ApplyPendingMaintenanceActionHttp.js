import * as docdb from "@distilled.cloud/aws/docdb";
import * as Layer from "effect/Layer";
import { ApplyPendingMaintenanceAction } from "./ApplyPendingMaintenanceAction.js";
import { makeDocDBAccountHttpBinding } from "./BindingHttp.js";
export const ApplyPendingMaintenanceActionHttp = Layer.effect(ApplyPendingMaintenanceAction, makeDocDBAccountHttpBinding({
    tag: "AWS.DocDB.ApplyPendingMaintenanceAction",
    operation: docdb.applyPendingMaintenanceAction,
    actions: ["rds:ApplyPendingMaintenanceAction"],
}));
//# sourceMappingURL=ApplyPendingMaintenanceActionHttp.js.map