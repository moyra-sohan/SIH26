import * as sdb from "@distilled.cloud/aws/simpledb";
import * as Layer from "effect/Layer";
import { makeSimpleDbBinding } from "./Binding.js";
import { DeleteAttributes } from "./DeleteAttributes.js";
export const DeleteAttributesHttp = Layer.effect(DeleteAttributes, makeSimpleDbBinding({
    operation: "DeleteAttributes",
    method: sdb.deleteAttributes,
}));
//# sourceMappingURL=DeleteAttributesHttp.js.map