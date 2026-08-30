import * as frauddetector from "@distilled.cloud/aws/frauddetector";
import * as Layer from "effect/Layer";
import { makeFraudDetectorEventTypeHttpBinding } from "./BindingHttp.js";
import { DeleteEventsByEventType } from "./DeleteEventsByEventType.js";
export const DeleteEventsByEventTypeHttp = Layer.effect(DeleteEventsByEventType, makeFraudDetectorEventTypeHttpBinding({
    tag: "AWS.FraudDetector.DeleteEventsByEventType",
    operation: frauddetector.deleteEventsByEventType,
    actions: ["frauddetector:DeleteEventsByEventType"],
}));
//# sourceMappingURL=DeleteEventsByEventTypeHttp.js.map