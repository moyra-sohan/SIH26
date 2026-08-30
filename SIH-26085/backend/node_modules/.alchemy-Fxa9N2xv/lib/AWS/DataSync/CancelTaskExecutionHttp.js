import * as datasync from "@distilled.cloud/aws/datasync";
import * as Layer from "effect/Layer";
import { makeDataSyncTaskExecutionHttpBinding } from "./BindingHttp.js";
import { CancelTaskExecution } from "./CancelTaskExecution.js";
export const CancelTaskExecutionHttp = Layer.effect(CancelTaskExecution, makeDataSyncTaskExecutionHttpBinding({
    tag: "AWS.DataSync.CancelTaskExecution",
    operation: datasync.cancelTaskExecution,
    actions: ["datasync:CancelTaskExecution"],
}));
//# sourceMappingURL=CancelTaskExecutionHttp.js.map