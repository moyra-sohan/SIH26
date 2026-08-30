import * as mediaconnect from "@distilled.cloud/aws/mediaconnect";
import * as Layer from "effect/Layer";
import { makeMediaConnectFlowHttpBinding } from "./BindingHttp.js";
import { DescribeFlowSourceThumbnail } from "./DescribeFlowSourceThumbnail.js";
export const DescribeFlowSourceThumbnailHttp = Layer.effect(DescribeFlowSourceThumbnail, makeMediaConnectFlowHttpBinding({
    tag: "AWS.MediaConnect.DescribeFlowSourceThumbnail",
    operation: mediaconnect.describeFlowSourceThumbnail,
    actions: ["mediaconnect:DescribeFlowSourceThumbnail"],
}));
//# sourceMappingURL=DescribeFlowSourceThumbnailHttp.js.map