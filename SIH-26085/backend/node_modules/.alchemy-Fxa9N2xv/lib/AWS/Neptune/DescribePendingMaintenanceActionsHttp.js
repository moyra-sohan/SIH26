import * as neptune from "@distilled.cloud/aws/neptune";
import * as Layer from "effect/Layer";
import { makeNeptuneAccountHttpBinding } from "./BindingHttp.js";
import { DescribePendingMaintenanceActions } from "./DescribePendingMaintenanceActions.js";
export const DescribePendingMaintenanceActionsHttp = Layer.effect(DescribePendingMaintenanceActions, makeNeptuneAccountHttpBinding({
    tag: "AWS.Neptune.DescribePendingMaintenanceActions",
    operation: neptune.describePendingMaintenanceActions,
    actions: ["rds:DescribePendingMaintenanceActions"],
}));
//# sourceMappingURL=DescribePendingMaintenanceActionsHttp.js.map