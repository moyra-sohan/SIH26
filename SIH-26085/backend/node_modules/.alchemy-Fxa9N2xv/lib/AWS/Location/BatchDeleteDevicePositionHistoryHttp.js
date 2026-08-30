import * as location from "@distilled.cloud/aws/location";
import * as Layer from "effect/Layer";
import { makeLocationTrackerHttpBinding } from "./BindingHttp.js";
import { BatchDeleteDevicePositionHistory } from "./BatchDeleteDevicePositionHistory.js";
export const BatchDeleteDevicePositionHistoryHttp = Layer.effect(BatchDeleteDevicePositionHistory, makeLocationTrackerHttpBinding({
    tag: "AWS.Location.BatchDeleteDevicePositionHistory",
    operation: location.batchDeleteDevicePositionHistory,
    actions: ["geo:BatchDeleteDevicePositionHistory"],
}));
//# sourceMappingURL=BatchDeleteDevicePositionHistoryHttp.js.map