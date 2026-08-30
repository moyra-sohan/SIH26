import * as rds from "@distilled.cloud/aws/rds";
import * as Layer from "effect/Layer";
import { makeRdsAccountHttpBinding } from "./BindingHttp.js";
import { DescribePendingMaintenanceActions } from "./DescribePendingMaintenanceActions.js";
export const DescribePendingMaintenanceActionsHttp = Layer.effect(DescribePendingMaintenanceActions, makeRdsAccountHttpBinding({
    tag: "AWS.RDS.DescribePendingMaintenanceActions",
    operation: rds.describePendingMaintenanceActions,
    actions: ["rds:DescribePendingMaintenanceActions"],
}));
//# sourceMappingURL=DescribePendingMaintenanceActionsHttp.js.map