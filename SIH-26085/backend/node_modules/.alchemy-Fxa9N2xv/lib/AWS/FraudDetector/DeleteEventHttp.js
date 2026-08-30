import * as frauddetector from "@distilled.cloud/aws/frauddetector";
import * as Layer from "effect/Layer";
import { makeFraudDetectorEventTypeHttpBinding } from "./BindingHttp.js";
import { DeleteEvent } from "./DeleteEvent.js";
export const DeleteEventHttp = Layer.effect(DeleteEvent, makeFraudDetectorEventTypeHttpBinding({
    tag: "AWS.FraudDetector.DeleteEvent",
    operation: frauddetector.deleteEvent,
    actions: ["frauddetector:DeleteEvent"],
}));
//# sourceMappingURL=DeleteEventHttp.js.map