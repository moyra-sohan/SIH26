import * as quicksight from "@distilled.cloud/aws/quicksight";
import * as Layer from "effect/Layer";
import { makeQuickSightDataSetHttpBinding } from "./BindingHttp.js";
import { CancelIngestion } from "./CancelIngestion.js";
export const CancelIngestionHttp = Layer.effect(CancelIngestion, makeQuickSightDataSetHttpBinding({
    tag: "AWS.QuickSight.CancelIngestion",
    operation: quicksight.cancelIngestion,
    actions: ["quicksight:CancelIngestion"],
}));
//# sourceMappingURL=CancelIngestionHttp.js.map