import * as agentcore from "@distilled.cloud/aws/bedrock-agentcore";
import * as Layer from "effect/Layer";
import { makeAgentCoreHttpBinding } from "./BindingHttp.js";
import { BatchCreateMemoryRecords } from "./BatchCreateMemoryRecords.js";
export const BatchCreateMemoryRecordsHttp = Layer.effect(BatchCreateMemoryRecords, makeAgentCoreHttpBinding({
    tag: "AWS.BedrockAgentCore.BatchCreateMemoryRecords",
    operation: agentcore.batchCreateMemoryRecords,
    actions: ["bedrock-agentcore:BatchCreateMemoryRecords"],
    requestKey: "memoryId",
    identifier: (memory) => memory.memoryId,
    arns: (memory) => [memory.memoryArn],
}));
//# sourceMappingURL=BatchCreateMemoryRecordsHttp.js.map