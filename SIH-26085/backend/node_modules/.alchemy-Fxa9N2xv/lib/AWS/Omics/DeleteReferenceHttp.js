import * as omics from "@distilled.cloud/aws/omics";
import * as Layer from "effect/Layer";
import { makeOmicsResourceHttpBinding } from "./BindingHttp.js";
import { DeleteReference } from "./DeleteReference.js";
export const DeleteReferenceHttp = Layer.effect(DeleteReference, makeOmicsResourceHttpBinding({
    tag: "AWS.Omics.DeleteReference",
    operation: omics.deleteReference,
    actions: ["omics:DeleteReference"],
    key: "referenceStoreId",
    id: (store) => store.referenceStoreId,
    arn: (store) => store.referenceStoreArn,
}));
//# sourceMappingURL=DeleteReferenceHttp.js.map