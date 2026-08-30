import * as ga from "@distilled.cloud/aws/global-accelerator";
import * as Layer from "effect/Layer";
import { makeGaEndpointGroupHttpBinding } from "./BindingHttp.js";
import { DescribeEndpointGroup } from "./DescribeEndpointGroup.js";
export const DescribeEndpointGroupHttp = Layer.effect(DescribeEndpointGroup, makeGaEndpointGroupHttpBinding({
    tag: "AWS.GlobalAccelerator.DescribeEndpointGroup",
    operation: ga.describeEndpointGroup,
    actions: ["globalaccelerator:DescribeEndpointGroup"],
}));
//# sourceMappingURL=DescribeEndpointGroupHttp.js.map