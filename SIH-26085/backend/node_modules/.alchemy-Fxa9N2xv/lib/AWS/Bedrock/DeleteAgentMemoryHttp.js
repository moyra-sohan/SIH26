import * as bedrock from "@distilled.cloud/aws/bedrock-agent-runtime";
import * as Layer from "effect/Layer";
import { makeAgentAliasScopedHttpBinding } from "./BindingHttp.js";
import { DeleteAgentMemory } from "./DeleteAgentMemory.js";
export const DeleteAgentMemoryHttp = Layer.effect(DeleteAgentMemory, makeAgentAliasScopedHttpBinding({
    tag: "AWS.Bedrock.DeleteAgentMemory",
    operation: bedrock.deleteAgentMemory,
    actions: ["bedrock:DeleteAgentMemory"],
}));
//# sourceMappingURL=DeleteAgentMemoryHttp.js.map