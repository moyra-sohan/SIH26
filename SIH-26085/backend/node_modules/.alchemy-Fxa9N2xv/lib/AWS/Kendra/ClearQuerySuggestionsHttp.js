import * as kendra from "@distilled.cloud/aws/kendra";
import * as Layer from "effect/Layer";
import { makeKendraIndexHttpBinding } from "./BindingHttp.js";
import { ClearQuerySuggestions } from "./ClearQuerySuggestions.js";
export const ClearQuerySuggestionsHttp = Layer.effect(ClearQuerySuggestions, makeKendraIndexHttpBinding({
    tag: "AWS.Kendra.ClearQuerySuggestions",
    operation: kendra.clearQuerySuggestions,
    actions: ["kendra:ClearQuerySuggestions"],
}));
//# sourceMappingURL=ClearQuerySuggestionsHttp.js.map