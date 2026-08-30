import * as quicksight from "@distilled.cloud/aws/quicksight";
import * as Layer from "effect/Layer";
import { makeQuickSightDashboardHttpBinding } from "./BindingHttp.js";
import { DescribeDashboardSnapshotJobResult } from "./DescribeDashboardSnapshotJobResult.js";
export const DescribeDashboardSnapshotJobResultHttp = Layer.effect(DescribeDashboardSnapshotJobResult, makeQuickSightDashboardHttpBinding({
    tag: "AWS.QuickSight.DescribeDashboardSnapshotJobResult",
    operation: quicksight.describeDashboardSnapshotJobResult,
    actions: ["quicksight:DescribeDashboardSnapshotJobResult"],
}));
//# sourceMappingURL=DescribeDashboardSnapshotJobResultHttp.js.map