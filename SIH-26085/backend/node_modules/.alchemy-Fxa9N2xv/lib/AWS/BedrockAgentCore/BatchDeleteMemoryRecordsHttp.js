import * as agentcore from "@distilled.cloud/aws/bedrock-agentcore";
import * as Layer from "effect/Layer";
import { makeAgentCoreHttpBinding } from "./BindingHttp.js";
import { BatchDeleteMemoryRecords } from "./BatchDeleteMemoryRecords.js";
export const BatchDeleteMemoryRecordsHttp = Layer.effect(BatchDeleteMemoryRecords, makeAgentCoreHttpBinding({
    tag: "AWS.BedrockAgentCore.BatchDeleteMemoryRecords",
    operation: agentcore.batchDeleteMemoryRecords,
    actions: ["bedrock-agentcore:BatchDeleteMemoryRecords"],
    requestKey: "memoryId",
    identifier: (memory) => memory.memoryId,
    arns: (memory) => [memory.memoryArn],
}));
//# sourceMappingURL=BatchDeleteMemoryRecordsHttp.js.map