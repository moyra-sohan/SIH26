import * as neptune from "@distilled.cloud/aws/neptune";
import * as Layer from "effect/Layer";
import { ApplyPendingMaintenanceAction } from "./ApplyPendingMaintenanceAction.js";
import { makeNeptuneAccountHttpBinding } from "./BindingHttp.js";
export const ApplyPendingMaintenanceActionHttp = Layer.effect(ApplyPendingMaintenanceAction, makeNeptuneAccountHttpBinding({
    tag: "AWS.Neptune.ApplyPendingMaintenanceAction",
    operation: neptune.applyPendingMaintenanceAction,
    actions: ["rds:ApplyPendingMaintenanceAction"],
}));
//# sourceMappingURL=ApplyPendingMaintenanceActionHttp.js.map