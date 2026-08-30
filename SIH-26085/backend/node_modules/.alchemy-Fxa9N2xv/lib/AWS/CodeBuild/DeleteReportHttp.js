import * as codebuild from "@distilled.cloud/aws/codebuild";
import * as Layer from "effect/Layer";
import { makeCodeBuildReportGroupHttpBinding } from "./BindingHttp.js";
import { DeleteReport } from "./DeleteReport.js";
export const DeleteReportHttp = Layer.effect(DeleteReport, makeCodeBuildReportGroupHttpBinding({
    tag: "AWS.CodeBuild.DeleteReport",
    operation: codebuild.deleteReport,
    actions: ["codebuild:DeleteReport"],
}));
//# sourceMappingURL=DeleteReportHttp.js.map