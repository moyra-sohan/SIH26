import * as sitewise from "@distilled.cloud/aws/iotsitewise";
import * as Layer from "effect/Layer";
import { BatchPutAssetPropertyValue, } from "./BatchPutAssetPropertyValue.js";
import { makeSiteWiseAssetHttpBinding } from "./BindingHttp.js";
export const BatchPutAssetPropertyValueHttp = Layer.effect(BatchPutAssetPropertyValue, makeSiteWiseAssetHttpBinding({
    capability: "BatchPutAssetPropertyValue",
    iamActions: ["iotsitewise:BatchPutAssetPropertyValue"],
    operation: sitewise.batchPutAssetPropertyValue,
    // Inject the bound asset's id into every entry that does not target a
    // data stream by alias.
    prepare: (request, assetId) => ({
        ...request,
        entries: request.entries.map((entry) => entry.propertyAlias === undefined ? { ...entry, assetId } : entry),
    }),
}));
//# sourceMappingURL=BatchPutAssetPropertyValueHttp.js.map