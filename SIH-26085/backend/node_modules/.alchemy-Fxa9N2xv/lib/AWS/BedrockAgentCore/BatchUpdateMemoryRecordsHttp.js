import * as agentcore from "@distilled.cloud/aws/bedrock-agentcore";
import * as Layer from "effect/Layer";
import { makeAgentCoreHttpBinding } from "./BindingHttp.js";
import { BatchUpdateMemoryRecords } from "./BatchUpdateMemoryRecords.js";
export const BatchUpdateMemoryRecordsHttp = Layer.effect(BatchUpdateMemoryRecords, makeAgentCoreHttpBinding({
    tag: "AWS.BedrockAgentCore.BatchUpdateMemoryRecords",
    operation: agentcore.batchUpdateMemoryRecords,
    actions: ["bedrock-agentcore:BatchUpdateMemoryRecords"],
    requestKey: "memoryId",
    identifier: (memory) => memory.memoryId,
    arns: (memory) => [memory.memoryArn],
}));
//# sourceMappingURL=BatchUpdateMemoryRecordsHttp.js.map