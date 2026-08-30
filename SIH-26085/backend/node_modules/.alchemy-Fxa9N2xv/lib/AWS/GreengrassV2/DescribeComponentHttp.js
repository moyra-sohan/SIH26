import * as greengrassv2 from "@distilled.cloud/aws/greengrassv2";
import * as Layer from "effect/Layer";
import { makeGreengrassComponentHttpBinding } from "./BindingHttp.js";
import { DescribeComponent } from "./DescribeComponent.js";
export const DescribeComponentHttp = Layer.effect(DescribeComponent, makeGreengrassComponentHttpBinding({
    tag: "AWS.GreengrassV2.DescribeComponent",
    operation: greengrassv2.describeComponent,
    actions: ["greengrass:DescribeComponent"],
}));
//# sourceMappingURL=DescribeComponentHttp.js.map