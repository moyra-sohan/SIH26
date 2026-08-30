import * as sitewise from "@distilled.cloud/aws/iotsitewise";
import * as Layer from "effect/Layer";
import { makeSiteWiseAssetHttpBinding } from "./BindingHttp.js";
import { DescribeAsset } from "./DescribeAsset.js";
export const DescribeAssetHttp = Layer.effect(DescribeAsset, makeSiteWiseAssetHttpBinding({
    capability: "DescribeAsset",
    iamActions: ["iotsitewise:DescribeAsset"],
    operation: sitewise.describeAsset,
    prepare: (request, assetId) => ({
        ...request,
        assetId,
    }),
}));
//# sourceMappingURL=DescribeAssetHttp.js.map