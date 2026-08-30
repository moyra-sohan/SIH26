import * as sagemaker from "@distilled.cloud/aws/sagemaker";
import * as Layer from "effect/Layer";
import { makeEndpointHttpBinding } from "./BindingHttp.js";
import { DescribeEndpoint } from "./DescribeEndpoint.js";
export const DescribeEndpointHttp = Layer.effect(DescribeEndpoint, makeEndpointHttpBinding({
    tag: "AWS.SageMaker.DescribeEndpoint",
    operation: sagemaker.describeEndpoint,
    actions: ["sagemaker:DescribeEndpoint"],
}));
//# sourceMappingURL=DescribeEndpointHttp.js.map