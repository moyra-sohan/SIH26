import * as synthetics from "@distilled.cloud/aws/synthetics";
import * as Layer from "effect/Layer";
import { makeSyntheticsAccountHttpBinding } from "./BindingHttp.js";
import { DescribeCanariesLastRun } from "./DescribeCanariesLastRun.js";
export const DescribeCanariesLastRunHttp = Layer.effect(DescribeCanariesLastRun, makeSyntheticsAccountHttpBinding({
    tag: "AWS.Synthetics.DescribeCanariesLastRun",
    operation: synthetics.describeCanariesLastRun,
    actions: ["synthetics:DescribeCanariesLastRun"],
}));
//# sourceMappingURL=DescribeCanariesLastRunHttp.js.map