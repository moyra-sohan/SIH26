import * as codepipeline from "@distilled.cloud/aws/codepipeline";
import * as Layer from "effect/Layer";
import { AcknowledgeJob } from "./AcknowledgeJob.js";
import { makeCodePipelineJobHttpBinding } from "./BindingHttp.js";
export const AcknowledgeJobHttp = Layer.effect(AcknowledgeJob, makeCodePipelineJobHttpBinding({
    tag: "AWS.CodePipeline.AcknowledgeJob",
    operation: codepipeline.acknowledgeJob,
    actions: ["codepipeline:AcknowledgeJob"],
}));
//# sourceMappingURL=AcknowledgeJobHttp.js.map