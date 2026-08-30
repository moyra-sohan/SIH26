import * as transcribe from "@distilled.cloud/aws/transcribe";
import * as Layer from "effect/Layer";
import { makeTranscribeHttpBinding } from "./BindingHttp.js";
import { CreateVocabularyFilter } from "./CreateVocabularyFilter.js";
export const CreateVocabularyFilterHttp = Layer.effect(CreateVocabularyFilter, makeTranscribeHttpBinding({
    tag: "AWS.Transcribe.CreateVocabularyFilter",
    operation: transcribe.createVocabularyFilter,
    actions: ["transcribe:CreateVocabularyFilter"],
}));
//# sourceMappingURL=CreateVocabularyFilterHttp.js.map