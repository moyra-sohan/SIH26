import * as transcribe from "@distilled.cloud/aws/transcribe";
import * as Layer from "effect/Layer";
import { makeTranscribeHttpBinding } from "./BindingHttp.js";
import { CreateMedicalVocabulary } from "./CreateMedicalVocabulary.js";
export const CreateMedicalVocabularyHttp = Layer.effect(CreateMedicalVocabulary, makeTranscribeHttpBinding({
    tag: "AWS.Transcribe.CreateMedicalVocabulary",
    operation: transcribe.createMedicalVocabulary,
    actions: ["transcribe:CreateMedicalVocabulary"],
}));
//# sourceMappingURL=CreateMedicalVocabularyHttp.js.map