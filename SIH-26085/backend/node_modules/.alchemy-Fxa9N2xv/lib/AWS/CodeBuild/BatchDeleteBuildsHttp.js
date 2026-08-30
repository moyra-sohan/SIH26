import * as codebuild from "@distilled.cloud/aws/codebuild";
import * as Layer from "effect/Layer";
import { makeCodeBuildProjectHttpBinding } from "./BindingHttp.js";
import { BatchDeleteBuilds } from "./BatchDeleteBuilds.js";
export const BatchDeleteBuildsHttp = Layer.effect(BatchDeleteBuilds, makeCodeBuildProjectHttpBinding({
    tag: "AWS.CodeBuild.BatchDeleteBuilds",
    operation: codebuild.batchDeleteBuilds,
    actions: ["codebuild:BatchDeleteBuilds"],
}));
//# sourceMappingURL=BatchDeleteBuildsHttp.js.map