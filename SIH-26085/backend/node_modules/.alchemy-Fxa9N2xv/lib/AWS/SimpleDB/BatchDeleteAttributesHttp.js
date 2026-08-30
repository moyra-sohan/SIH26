import * as sdb from "@distilled.cloud/aws/simpledb";
import * as Layer from "effect/Layer";
import { BatchDeleteAttributes } from "./BatchDeleteAttributes.js";
import { makeSimpleDbBinding } from "./Binding.js";
export const BatchDeleteAttributesHttp = Layer.effect(BatchDeleteAttributes, makeSimpleDbBinding({
    operation: "BatchDeleteAttributes",
    method: sdb.batchDeleteAttributes,
}));
//# sourceMappingURL=BatchDeleteAttributesHttp.js.map