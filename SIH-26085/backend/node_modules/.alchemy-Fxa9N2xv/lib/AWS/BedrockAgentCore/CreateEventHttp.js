import * as agentcore from "@distilled.cloud/aws/bedrock-agentcore";
import * as Layer from "effect/Layer";
import { makeAgentCoreHttpBinding } from "./BindingHttp.js";
import { CreateEvent } from "./CreateEvent.js";
export const CreateEventHttp = Layer.effect(CreateEvent, makeAgentCoreHttpBinding({
    tag: "AWS.BedrockAgentCore.CreateEvent",
    operation: agentcore.createEvent,
    actions: ["bedrock-agentcore:CreateEvent"],
    requestKey: "memoryId",
    identifier: (memory) => memory.memoryId,
    arns: (memory) => [memory.memoryArn],
}));
//# sourceMappingURL=CreateEventHttp.js.map