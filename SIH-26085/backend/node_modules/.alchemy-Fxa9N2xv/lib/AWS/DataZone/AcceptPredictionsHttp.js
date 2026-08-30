import * as datazone from "@distilled.cloud/aws/datazone";
import * as Layer from "effect/Layer";
import { makeDataZoneDomainHttpBinding } from "./BindingHttp.js";
import { AcceptPredictions } from "./AcceptPredictions.js";
export const AcceptPredictionsHttp = Layer.effect(AcceptPredictions, makeDataZoneDomainHttpBinding({
    tag: "AWS.DataZone.AcceptPredictions",
    operation: datazone.acceptPredictions,
    actions: ["datazone:AcceptPredictions"],
}));
//# sourceMappingURL=AcceptPredictionsHttp.js.map