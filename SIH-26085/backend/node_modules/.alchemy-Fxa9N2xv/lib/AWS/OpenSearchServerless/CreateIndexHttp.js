import * as aoss from "@distilled.cloud/aws/opensearchserverless";
import * as Layer from "effect/Layer";
import { makeAossCollectionHttpBinding } from "./BindingHttp.js";
import { CreateIndex } from "./CreateIndex.js";
export const CreateIndexHttp = Layer.effect(CreateIndex, makeAossCollectionHttpBinding({
    tag: "AWS.OpenSearchServerless.CreateIndex",
    operation: aoss.createIndex,
    actions: ["aoss:APIAccessAll"],
}));
//# sourceMappingURL=CreateIndexHttp.js.map