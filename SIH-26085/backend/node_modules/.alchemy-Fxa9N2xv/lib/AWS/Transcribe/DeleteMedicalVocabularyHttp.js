import * as transcribe from "@distilled.cloud/aws/transcribe";
import * as Layer from "effect/Layer";
import { makeTranscribeHttpBinding } from "./BindingHttp.js";
import { DeleteMedicalVocabulary } from "./DeleteMedicalVocabulary.js";
export const DeleteMedicalVocabularyHttp = Layer.effect(DeleteMedicalVocabulary, makeTranscribeHttpBinding({
    tag: "AWS.Transcribe.DeleteMedicalVocabulary",
    operation: transcribe.deleteMedicalVocabulary,
    actions: ["transcribe:DeleteMedicalVocabulary"],
}));
//# sourceMappingURL=DeleteMedicalVocabularyHttp.js.map