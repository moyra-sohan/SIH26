import * as ivs from "@distilled.cloud/aws/ivs";
import * as Layer from "effect/Layer";
import { BatchStartViewerSessionRevocation } from "./BatchStartViewerSessionRevocation.js";
import { makeIvsAccountHttpBinding } from "./BindingHttp.js";
export const BatchStartViewerSessionRevocationHttp = Layer.effect(BatchStartViewerSessionRevocation, makeIvsAccountHttpBinding({
    tag: "AWS.IVS.BatchStartViewerSessionRevocation",
    operation: ivs.batchStartViewerSessionRevocation,
    actions: ["ivs:BatchStartViewerSessionRevocation"],
}));
//# sourceMappingURL=BatchStartViewerSessionRevocationHttp.js.map