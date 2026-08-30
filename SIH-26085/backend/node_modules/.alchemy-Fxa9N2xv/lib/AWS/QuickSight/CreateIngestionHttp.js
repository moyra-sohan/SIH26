import * as quicksight from "@distilled.cloud/aws/quicksight";
import * as Layer from "effect/Layer";
import { makeQuickSightDataSetHttpBinding } from "./BindingHttp.js";
import { CreateIngestion } from "./CreateIngestion.js";
export const CreateIngestionHttp = Layer.effect(CreateIngestion, makeQuickSightDataSetHttpBinding({
    tag: "AWS.QuickSight.CreateIngestion",
    operation: quicksight.createIngestion,
    actions: ["quicksight:CreateIngestion"],
}));
//# sourceMappingURL=CreateIngestionHttp.js.map