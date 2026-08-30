import * as aa from "@distilled.cloud/aws/accessanalyzer";
import * as Layer from "effect/Layer";
import { makeAccessAnalyzerAccountHttpBinding } from "./BindingHttp.js";
import { CheckAccessNotGranted } from "./CheckAccessNotGranted.js";
export const CheckAccessNotGrantedHttp = Layer.effect(CheckAccessNotGranted, makeAccessAnalyzerAccountHttpBinding({
    tag: "AWS.AccessAnalyzer.CheckAccessNotGranted",
    operation: aa.checkAccessNotGranted,
    actions: ["access-analyzer:CheckAccessNotGranted"],
}));
//# sourceMappingURL=CheckAccessNotGrantedHttp.js.map