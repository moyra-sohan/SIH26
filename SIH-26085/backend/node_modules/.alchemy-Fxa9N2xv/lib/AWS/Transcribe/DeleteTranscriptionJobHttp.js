import * as transcribe from "@distilled.cloud/aws/transcribe";
import * as Layer from "effect/Layer";
import { makeTranscribeHttpBinding } from "./BindingHttp.js";
import { DeleteTranscriptionJob } from "./DeleteTranscriptionJob.js";
export const DeleteTranscriptionJobHttp = Layer.effect(DeleteTranscriptionJob, makeTranscribeHttpBinding({
    tag: "AWS.Transcribe.DeleteTranscriptionJob",
    operation: transcribe.deleteTranscriptionJob,
    actions: ["transcribe:DeleteTranscriptionJob"],
}));
//# sourceMappingURL=DeleteTranscriptionJobHttp.js.map