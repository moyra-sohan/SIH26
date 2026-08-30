import * as forecast from "@distilled.cloud/aws/forecast";
import * as Layer from "effect/Layer";
import { makeForecastHttpBinding } from "./BindingHttp.js";
import { CreateWhatIfAnalysis } from "./CreateWhatIfAnalysis.js";
export const CreateWhatIfAnalysisHttp = Layer.effect(CreateWhatIfAnalysis, makeForecastHttpBinding({
    capability: "CreateWhatIfAnalysis",
    iamActions: ["forecast:CreateWhatIfAnalysis"],
    operation: forecast.createWhatIfAnalysis,
}));
//# sourceMappingURL=CreateWhatIfAnalysisHttp.js.map