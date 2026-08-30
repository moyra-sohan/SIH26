import * as sdb from "@distilled.cloud/aws/simpledb";
import * as Layer from "effect/Layer";
import { BatchPutAttributes } from "./BatchPutAttributes.js";
import { makeSimpleDbBinding } from "./Binding.js";
export const BatchPutAttributesHttp = Layer.effect(BatchPutAttributes, makeSimpleDbBinding({
    operation: "BatchPutAttributes",
    method: sdb.batchPutAttributes,
}));
//# sourceMappingURL=BatchPutAttributesHttp.js.map