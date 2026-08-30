import * as transcribe from "@distilled.cloud/aws/transcribe";
import * as Layer from "effect/Layer";
import { makeTranscribeHttpBinding } from "./BindingHttp.js";
import { DescribeLanguageModel } from "./DescribeLanguageModel.js";
export const DescribeLanguageModelHttp = Layer.effect(DescribeLanguageModel, makeTranscribeHttpBinding({
    tag: "AWS.Transcribe.DescribeLanguageModel",
    operation: transcribe.describeLanguageModel,
    actions: ["transcribe:DescribeLanguageModel"],
}));
//# sourceMappingURL=DescribeLanguageModelHttp.js.map