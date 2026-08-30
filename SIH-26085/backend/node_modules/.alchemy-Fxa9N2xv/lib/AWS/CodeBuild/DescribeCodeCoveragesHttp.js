import * as codebuild from "@distilled.cloud/aws/codebuild";
import * as Layer from "effect/Layer";
import { makeCodeBuildReportGroupHttpBinding } from "./BindingHttp.js";
import { DescribeCodeCoverages } from "./DescribeCodeCoverages.js";
export const DescribeCodeCoveragesHttp = Layer.effect(DescribeCodeCoverages, makeCodeBuildReportGroupHttpBinding({
    tag: "AWS.CodeBuild.DescribeCodeCoverages",
    operation: codebuild.describeCodeCoverages,
    actions: ["codebuild:DescribeCodeCoverages"],
}));
//# sourceMappingURL=DescribeCodeCoveragesHttp.js.map