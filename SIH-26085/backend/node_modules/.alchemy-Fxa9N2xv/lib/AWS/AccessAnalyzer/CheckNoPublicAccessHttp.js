import * as aa from "@distilled.cloud/aws/accessanalyzer";
import * as Layer from "effect/Layer";
import { makeAccessAnalyzerAccountHttpBinding } from "./BindingHttp.js";
import { CheckNoPublicAccess } from "./CheckNoPublicAccess.js";
export const CheckNoPublicAccessHttp = Layer.effect(CheckNoPublicAccess, makeAccessAnalyzerAccountHttpBinding({
    tag: "AWS.AccessAnalyzer.CheckNoPublicAccess",
    operation: aa.checkNoPublicAccess,
    actions: ["access-analyzer:CheckNoPublicAccess"],
}));
//# sourceMappingURL=CheckNoPublicAccessHttp.js.map