import * as aoss from "@distilled.cloud/aws/opensearchserverless";
import * as Layer from "effect/Layer";
import { makeAossCollectionHttpBinding } from "./BindingHttp.js";
import { DeleteIndex } from "./DeleteIndex.js";
export const DeleteIndexHttp = Layer.effect(DeleteIndex, makeAossCollectionHttpBinding({
    tag: "AWS.OpenSearchServerless.DeleteIndex",
    operation: aoss.deleteIndex,
    actions: ["aoss:APIAccessAll"],
}));
//# sourceMappingURL=DeleteIndexHttp.js.map