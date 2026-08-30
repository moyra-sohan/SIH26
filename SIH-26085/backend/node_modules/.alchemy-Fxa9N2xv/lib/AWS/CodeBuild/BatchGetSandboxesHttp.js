import * as codebuild from "@distilled.cloud/aws/codebuild";
import * as Layer from "effect/Layer";
import { makeCodeBuildProjectHttpBinding } from "./BindingHttp.js";
import { BatchGetSandboxes } from "./BatchGetSandboxes.js";
export const BatchGetSandboxesHttp = Layer.effect(BatchGetSandboxes, makeCodeBuildProjectHttpBinding({
    tag: "AWS.CodeBuild.BatchGetSandboxes",
    operation: codebuild.batchGetSandboxes,
    actions: ["codebuild:BatchGetSandboxes"],
    sandboxScoped: true,
}));
//# sourceMappingURL=BatchGetSandboxesHttp.js.map