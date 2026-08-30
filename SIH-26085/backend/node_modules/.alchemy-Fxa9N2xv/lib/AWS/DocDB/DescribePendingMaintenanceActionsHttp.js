import * as docdb from "@distilled.cloud/aws/docdb";
import * as Layer from "effect/Layer";
import { makeDocDBAccountHttpBinding } from "./BindingHttp.js";
import { DescribePendingMaintenanceActions } from "./DescribePendingMaintenanceActions.js";
export const DescribePendingMaintenanceActionsHttp = Layer.effect(DescribePendingMaintenanceActions, makeDocDBAccountHttpBinding({
    tag: "AWS.DocDB.DescribePendingMaintenanceActions",
    operation: docdb.describePendingMaintenanceActions,
    actions: ["rds:DescribePendingMaintenanceActions"],
}));
//# sourceMappingURL=DescribePendingMaintenanceActionsHttp.js.map