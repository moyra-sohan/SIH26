import * as codebuild from "@distilled.cloud/aws/codebuild";
import * as Layer from "effect/Layer";
import { BatchGetBuilds } from "./BatchGetBuilds.js";
import { makeCodeBuildProjectHttpBinding } from "./BindingHttp.js";
export const BatchGetBuildsHttp = Layer.effect(BatchGetBuilds, makeCodeBuildProjectHttpBinding({
    tag: "AWS.CodeBuild.BatchGetBuilds",
    operation: codebuild.batchGetBuilds,
    actions: ["codebuild:BatchGetBuilds"],
}));
//# sourceMappingURL=BatchGetBuildsHttp.js.map