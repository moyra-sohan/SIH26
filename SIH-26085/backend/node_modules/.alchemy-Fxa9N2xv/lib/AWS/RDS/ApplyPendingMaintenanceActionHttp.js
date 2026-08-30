import * as rds from "@distilled.cloud/aws/rds";
import * as Layer from "effect/Layer";
import { makeRdsAccountHttpBinding } from "./BindingHttp.js";
import { ApplyPendingMaintenanceAction } from "./ApplyPendingMaintenanceAction.js";
export const ApplyPendingMaintenanceActionHttp = Layer.effect(ApplyPendingMaintenanceAction, makeRdsAccountHttpBinding({
    tag: "AWS.RDS.ApplyPendingMaintenanceAction",
    operation: rds.applyPendingMaintenanceAction,
    actions: ["rds:ApplyPendingMaintenanceAction"],
}));
//# sourceMappingURL=ApplyPendingMaintenanceActionHttp.js.map