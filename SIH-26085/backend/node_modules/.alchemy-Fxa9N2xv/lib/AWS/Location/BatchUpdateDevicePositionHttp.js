import * as location from "@distilled.cloud/aws/location";
import * as Layer from "effect/Layer";
import { makeLocationTrackerHttpBinding } from "./BindingHttp.js";
import { BatchUpdateDevicePosition } from "./BatchUpdateDevicePosition.js";
export const BatchUpdateDevicePositionHttp = Layer.effect(BatchUpdateDevicePosition, makeLocationTrackerHttpBinding({
    tag: "AWS.Location.BatchUpdateDevicePosition",
    operation: location.batchUpdateDevicePosition,
    actions: ["geo:BatchUpdateDevicePosition"],
}));
//# sourceMappingURL=BatchUpdateDevicePositionHttp.js.map