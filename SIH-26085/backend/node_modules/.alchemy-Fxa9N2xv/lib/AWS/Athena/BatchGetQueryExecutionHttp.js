import * as athena from "@distilled.cloud/aws/athena";
import * as Layer from "effect/Layer";
import { makeWorkGroupScopedHttpBinding } from "./BindingHttp.js";
import { BatchGetQueryExecution } from "./BatchGetQueryExecution.js";
export const BatchGetQueryExecutionHttp = Layer.effect(BatchGetQueryExecution, makeWorkGroupScopedHttpBinding({
    tag: "AWS.Athena.BatchGetQueryExecution",
    operation: athena.batchGetQueryExecution,
    actions: ["athena:BatchGetQueryExecution"],
}));
//# sourceMappingURL=BatchGetQueryExecutionHttp.js.map