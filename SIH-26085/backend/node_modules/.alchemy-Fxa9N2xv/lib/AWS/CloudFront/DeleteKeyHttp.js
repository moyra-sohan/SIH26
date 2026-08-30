import * as kvs from "@distilled.cloud/aws/cloudfront-keyvaluestore";
import * as Layer from "effect/Layer";
import { makeKeyValueStoreScopedHttpBinding } from "./BindingHttp.js";
import { DeleteKey } from "./DeleteKey.js";
export const DeleteKeyHttp = Layer.effect(DeleteKey, makeKeyValueStoreScopedHttpBinding({
    tag: "AWS.CloudFront.DeleteKey",
    operation: kvs.deleteKey,
    actions: ["cloudfront-keyvaluestore:DeleteKey"],
}));
//# sourceMappingURL=DeleteKeyHttp.js.map