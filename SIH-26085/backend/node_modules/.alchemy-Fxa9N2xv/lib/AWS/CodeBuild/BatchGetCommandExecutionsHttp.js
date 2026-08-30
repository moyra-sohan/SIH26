import * as codebuild from "@distilled.cloud/aws/codebuild";
import * as Layer from "effect/Layer";
import { makeCodeBuildProjectHttpBinding } from "./BindingHttp.js";
import { BatchGetCommandExecutions } from "./BatchGetCommandExecutions.js";
export const BatchGetCommandExecutionsHttp = Layer.effect(BatchGetCommandExecutions, makeCodeBuildProjectHttpBinding({
    tag: "AWS.CodeBuild.BatchGetCommandExecutions",
    operation: codebuild.batchGetCommandExecutions,
    actions: ["codebuild:BatchGetCommandExecutions"],
    sandboxScoped: true,
}));
//# sourceMappingURL=BatchGetCommandExecutionsHttp.js.map