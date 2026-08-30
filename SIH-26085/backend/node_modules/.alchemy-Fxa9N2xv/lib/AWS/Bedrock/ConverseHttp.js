import * as bedrock from "@distilled.cloud/aws/bedrock-runtime";
import * as Layer from "effect/Layer";
import { makeModelScopedHttpBinding } from "./BindingHttp.js";
import { Converse } from "./Converse.js";
export const ConverseHttp = Layer.effect(Converse, makeModelScopedHttpBinding({
    tag: "AWS.Bedrock.Converse",
    operation: bedrock.converse,
    actions: ["bedrock:InvokeModel"],
}));
//# sourceMappingURL=ConverseHttp.js.map