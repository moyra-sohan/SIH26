import * as transcribe from "@distilled.cloud/aws/transcribe";
import * as Layer from "effect/Layer";
import { makeTranscribeHttpBinding } from "./BindingHttp.js";
import { DeleteCallAnalyticsJob } from "./DeleteCallAnalyticsJob.js";
export const DeleteCallAnalyticsJobHttp = Layer.effect(DeleteCallAnalyticsJob, makeTranscribeHttpBinding({
    tag: "AWS.Transcribe.DeleteCallAnalyticsJob",
    operation: transcribe.deleteCallAnalyticsJob,
    actions: ["transcribe:DeleteCallAnalyticsJob"],
}));
//# sourceMappingURL=DeleteCallAnalyticsJobHttp.js.map