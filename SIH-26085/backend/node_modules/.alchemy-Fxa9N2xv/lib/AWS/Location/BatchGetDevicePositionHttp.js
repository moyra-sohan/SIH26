import * as location from "@distilled.cloud/aws/location";
import * as Layer from "effect/Layer";
import { makeLocationTrackerHttpBinding } from "./BindingHttp.js";
import { BatchGetDevicePosition } from "./BatchGetDevicePosition.js";
export const BatchGetDevicePositionHttp = Layer.effect(BatchGetDevicePosition, makeLocationTrackerHttpBinding({
    tag: "AWS.Location.BatchGetDevicePosition",
    operation: location.batchGetDevicePosition,
    actions: ["geo:BatchGetDevicePosition"],
}));
//# sourceMappingURL=BatchGetDevicePositionHttp.js.map