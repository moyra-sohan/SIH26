import * as location from "@distilled.cloud/aws/location";
import * as Layer from "effect/Layer";
import { makeLocationCollectionHttpBinding } from "./BindingHttp.js";
import { BatchDeleteGeofence } from "./BatchDeleteGeofence.js";
export const BatchDeleteGeofenceHttp = Layer.effect(BatchDeleteGeofence, makeLocationCollectionHttpBinding({
    tag: "AWS.Location.BatchDeleteGeofence",
    operation: location.batchDeleteGeofence,
    actions: ["geo:BatchDeleteGeofence"],
}));
//# sourceMappingURL=BatchDeleteGeofenceHttp.js.map