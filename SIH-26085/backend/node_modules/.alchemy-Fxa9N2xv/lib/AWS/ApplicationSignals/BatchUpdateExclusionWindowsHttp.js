import * as appsignals from "@distilled.cloud/aws/application-signals";
import * as Layer from "effect/Layer";
import { BatchUpdateExclusionWindows } from "./BatchUpdateExclusionWindows.js";
import { makeSloBatchHttpBinding } from "./BindingHttp.js";
export const BatchUpdateExclusionWindowsHttp = Layer.effect(BatchUpdateExclusionWindows, makeSloBatchHttpBinding({
    tag: "AWS.ApplicationSignals.BatchUpdateExclusionWindows",
    operation: appsignals.batchUpdateExclusionWindows,
    actions: ["application-signals:BatchUpdateExclusionWindows"],
}));
//# sourceMappingURL=BatchUpdateExclusionWindowsHttp.js.map