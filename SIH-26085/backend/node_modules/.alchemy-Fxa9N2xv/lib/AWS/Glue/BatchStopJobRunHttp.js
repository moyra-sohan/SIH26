import * as glue from "@distilled.cloud/aws/glue";
import * as Layer from "effect/Layer";
import { makeGlueJobHttpBinding } from "./BindingHttp.js";
import { BatchStopJobRun } from "./BatchStopJobRun.js";
export const BatchStopJobRunHttp = Layer.effect(BatchStopJobRun, makeGlueJobHttpBinding({
    tag: "AWS.Glue.BatchStopJobRun",
    operation: glue.batchStopJobRun,
    actions: ["glue:BatchStopJobRun"],
}));
//# sourceMappingURL=BatchStopJobRunHttp.js.map