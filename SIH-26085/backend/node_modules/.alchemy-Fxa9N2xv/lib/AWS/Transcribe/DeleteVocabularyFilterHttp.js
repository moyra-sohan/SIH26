import * as transcribe from "@distilled.cloud/aws/transcribe";
import * as Layer from "effect/Layer";
import { makeTranscribeHttpBinding } from "./BindingHttp.js";
import { DeleteVocabularyFilter } from "./DeleteVocabularyFilter.js";
export const DeleteVocabularyFilterHttp = Layer.effect(DeleteVocabularyFilter, makeTranscribeHttpBinding({
    tag: "AWS.Transcribe.DeleteVocabularyFilter",
    operation: transcribe.deleteVocabularyFilter,
    actions: ["transcribe:DeleteVocabularyFilter"],
}));
//# sourceMappingURL=DeleteVocabularyFilterHttp.js.map