import * as aoss from "@distilled.cloud/aws/opensearchserverless";
import * as Layer from "effect/Layer";
import { BatchGetEffectiveLifecyclePolicy } from "./BatchGetEffectiveLifecyclePolicy.js";
import { makeAossAccountHttpBinding } from "./BindingHttp.js";
export const BatchGetEffectiveLifecyclePolicyHttp = Layer.effect(BatchGetEffectiveLifecyclePolicy, makeAossAccountHttpBinding({
    tag: "AWS.OpenSearchServerless.BatchGetEffectiveLifecyclePolicy",
    operation: aoss.batchGetEffectiveLifecyclePolicy,
    actions: ["aoss:BatchGetEffectiveLifecyclePolicy"],
}));
//# sourceMappingURL=BatchGetEffectiveLifecyclePolicyHttp.js.map