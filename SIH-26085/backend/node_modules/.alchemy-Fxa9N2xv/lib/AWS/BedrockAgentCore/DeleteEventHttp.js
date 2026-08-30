import * as agentcore from "@distilled.cloud/aws/bedrock-agentcore";
import * as Layer from "effect/Layer";
import { makeAgentCoreHttpBinding } from "./BindingHttp.js";
import { DeleteEvent } from "./DeleteEvent.js";
export const DeleteEventHttp = Layer.effect(DeleteEvent, makeAgentCoreHttpBinding({
    tag: "AWS.BedrockAgentCore.DeleteEvent",
    operation: agentcore.deleteEvent,
    actions: ["bedrock-agentcore:DeleteEvent"],
    requestKey: "memoryId",
    identifier: (memory) => memory.memoryId,
    arns: (memory) => [memory.memoryArn],
}));
//# sourceMappingURL=DeleteEventHttp.js.map