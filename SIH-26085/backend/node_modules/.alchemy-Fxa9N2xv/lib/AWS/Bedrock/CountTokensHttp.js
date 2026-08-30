import * as bedrock from "@distilled.cloud/aws/bedrock-runtime";
import * as Layer from "effect/Layer";
import { makeModelScopedHttpBinding } from "./BindingHttp.js";
import { CountTokens } from "./CountTokens.js";
export const CountTokensHttp = Layer.effect(CountTokens, makeModelScopedHttpBinding({
    tag: "AWS.Bedrock.CountTokens",
    operation: bedrock.countTokens,
    actions: ["bedrock:CountTokens"],
}));
//# sourceMappingURL=CountTokensHttp.js.map