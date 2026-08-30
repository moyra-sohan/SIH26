import * as transcribe from "@distilled.cloud/aws/transcribe";
import * as Layer from "effect/Layer";
import { makeTranscribeHttpBinding } from "./BindingHttp.js";
import { DeleteMedicalTranscriptionJob } from "./DeleteMedicalTranscriptionJob.js";
export const DeleteMedicalTranscriptionJobHttp = Layer.effect(DeleteMedicalTranscriptionJob, makeTranscribeHttpBinding({
    tag: "AWS.Transcribe.DeleteMedicalTranscriptionJob",
    operation: transcribe.deleteMedicalTranscriptionJob,
    actions: ["transcribe:DeleteMedicalTranscriptionJob"],
}));
//# sourceMappingURL=DeleteMedicalTranscriptionJobHttp.js.map