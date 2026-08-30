import * as transcribe from "@distilled.cloud/aws/transcribe";
import * as Layer from "effect/Layer";
import { makeTranscribeHttpBinding } from "./BindingHttp.js";
import { DeleteLanguageModel } from "./DeleteLanguageModel.js";
export const DeleteLanguageModelHttp = Layer.effect(DeleteLanguageModel, makeTranscribeHttpBinding({
    tag: "AWS.Transcribe.DeleteLanguageModel",
    operation: transcribe.deleteLanguageModel,
    actions: ["transcribe:DeleteLanguageModel"],
}));
//# sourceMappingURL=DeleteLanguageModelHttp.js.map