import * as forecast from "@distilled.cloud/aws/forecast";
import * as Layer from "effect/Layer";
import { makeForecastHttpBinding } from "./BindingHttp.js";
import { CreateAutoPredictor } from "./CreateAutoPredictor.js";
export const CreateAutoPredictorHttp = Layer.effect(CreateAutoPredictor, makeForecastHttpBinding({
    capability: "CreateAutoPredictor",
    iamActions: ["forecast:CreateAutoPredictor"],
    operation: forecast.createAutoPredictor,
    passRole: true,
}));
//# sourceMappingURL=CreateAutoPredictorHttp.js.map