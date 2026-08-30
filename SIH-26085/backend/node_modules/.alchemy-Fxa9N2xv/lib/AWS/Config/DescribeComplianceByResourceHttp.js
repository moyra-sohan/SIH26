import * as config from "@distilled.cloud/aws/config-service";
import * as Layer from "effect/Layer";
import { makeConfigAccountHttpBinding } from "./BindingHttp.js";
import { DescribeComplianceByResource } from "./DescribeComplianceByResource.js";
export const DescribeComplianceByResourceHttp = Layer.effect(DescribeComplianceByResource, makeConfigAccountHttpBinding({
    tag: "AWS.Config.DescribeComplianceByResource",
    operation: config.describeComplianceByResource,
    actions: ["config:DescribeComplianceByResource"],
}));
//# sourceMappingURL=DescribeComplianceByResourceHttp.js.map