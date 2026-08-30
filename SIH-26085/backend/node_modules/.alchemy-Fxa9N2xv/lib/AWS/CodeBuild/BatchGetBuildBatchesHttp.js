import * as codebuild from "@distilled.cloud/aws/codebuild";
import * as Layer from "effect/Layer";
import { makeCodeBuildProjectHttpBinding } from "./BindingHttp.js";
import { BatchGetBuildBatches } from "./BatchGetBuildBatches.js";
export const BatchGetBuildBatchesHttp = Layer.effect(BatchGetBuildBatches, makeCodeBuildProjectHttpBinding({
    tag: "AWS.CodeBuild.BatchGetBuildBatches",
    operation: codebuild.batchGetBuildBatches,
    actions: ["codebuild:BatchGetBuildBatches"],
}));
//# sourceMappingURL=BatchGetBuildBatchesHttp.js.map