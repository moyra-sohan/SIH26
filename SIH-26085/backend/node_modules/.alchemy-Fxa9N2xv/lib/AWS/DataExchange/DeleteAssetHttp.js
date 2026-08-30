import * as dataexchange from "@distilled.cloud/aws/dataexchange";
import * as Layer from "effect/Layer";
import { makeRevisionHttpBinding, revisionAssetArns } from "./BindingHttp.js";
import { DeleteAsset } from "./DeleteAsset.js";
export const DeleteAssetHttp = Layer.effect(DeleteAsset, makeRevisionHttpBinding({
    tag: "AWS.DataExchange.DeleteAsset",
    operation: dataexchange.deleteAsset,
    actions: ["dataexchange:DeleteAsset"],
    resources: revisionAssetArns,
}));
//# sourceMappingURL=DeleteAssetHttp.js.map