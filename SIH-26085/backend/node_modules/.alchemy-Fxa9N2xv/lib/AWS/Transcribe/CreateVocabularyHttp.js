import * as transcribe from "@distilled.cloud/aws/transcribe";
import * as Layer from "effect/Layer";
import { makeTranscribeHttpBinding } from "./BindingHttp.js";
import { CreateVocabulary } from "./CreateVocabulary.js";
export const CreateVocabularyHttp = Layer.effect(CreateVocabulary, makeTranscribeHttpBinding({
    tag: "AWS.Transcribe.CreateVocabulary",
    operation: transcribe.createVocabulary,
    actions: ["transcribe:CreateVocabulary"],
}));
//# sourceMappingURL=CreateVocabularyHttp.js.map