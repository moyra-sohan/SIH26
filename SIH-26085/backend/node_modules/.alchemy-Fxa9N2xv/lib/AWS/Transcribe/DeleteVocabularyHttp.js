import * as transcribe from "@distilled.cloud/aws/transcribe";
import * as Layer from "effect/Layer";
import { makeTranscribeHttpBinding } from "./BindingHttp.js";
import { DeleteVocabulary } from "./DeleteVocabulary.js";
export const DeleteVocabularyHttp = Layer.effect(DeleteVocabulary, makeTranscribeHttpBinding({
    tag: "AWS.Transcribe.DeleteVocabulary",
    operation: transcribe.deleteVocabulary,
    actions: ["transcribe:DeleteVocabulary"],
}));
//# sourceMappingURL=DeleteVocabularyHttp.js.map