import * as codebuild from "@distilled.cloud/aws/codebuild";
import * as Layer from "effect/Layer";
import { makeCodeBuildReportGroupHttpBinding } from "./BindingHttp.js";
import { BatchGetReports } from "./BatchGetReports.js";
export const BatchGetReportsHttp = Layer.effect(BatchGetReports, makeCodeBuildReportGroupHttpBinding({
    tag: "AWS.CodeBuild.BatchGetReports",
    operation: codebuild.batchGetReports,
    actions: ["codebuild:BatchGetReports"],
}));
//# sourceMappingURL=BatchGetReportsHttp.js.map