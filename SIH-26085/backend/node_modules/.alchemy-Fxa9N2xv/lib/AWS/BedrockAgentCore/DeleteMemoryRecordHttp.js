import * as agentcore from "@distilled.cloud/aws/bedrock-agentcore";
import * as Layer from "effect/Layer";
import { makeAgentCoreHttpBinding } from "./BindingHttp.js";
import { DeleteMemoryRecord } from "./DeleteMemoryRecord.js";
export const DeleteMemoryRecordHttp = Layer.effect(DeleteMemoryRecord, makeAgentCoreHttpBinding({
    tag: "AWS.BedrockAgentCore.DeleteMemoryRecord",
    operation: agentcore.deleteMemoryRecord,
    actions: ["bedrock-agentcore:DeleteMemoryRecord"],
    requestKey: "memoryId",
    identifier: (memory) => memory.memoryId,
    arns: (memory) => [memory.memoryArn],
}));
//# sourceMappingURL=DeleteMemoryRecordHttp.js.map