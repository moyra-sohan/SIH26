import * as mediaconnect from "@distilled.cloud/aws/mediaconnect";
import * as Layer from "effect/Layer";
import { makeMediaConnectFlowHttpBinding } from "./BindingHttp.js";
import { DescribeFlowSourceMetadata } from "./DescribeFlowSourceMetadata.js";
export const DescribeFlowSourceMetadataHttp = Layer.effect(DescribeFlowSourceMetadata, makeMediaConnectFlowHttpBinding({
    tag: "AWS.MediaConnect.DescribeFlowSourceMetadata",
    operation: mediaconnect.describeFlowSourceMetadata,
    actions: ["mediaconnect:DescribeFlowSourceMetadata"],
}));
//# sourceMappingURL=DescribeFlowSourceMetadataHttp.js.map