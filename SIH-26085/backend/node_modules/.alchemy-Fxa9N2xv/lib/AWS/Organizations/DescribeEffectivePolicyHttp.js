import * as organizations from "@distilled.cloud/aws/organizations";
import * as Layer from "effect/Layer";
import { makeOrganizationsHttpBinding } from "./BindingHttp.js";
import { DescribeEffectivePolicy } from "./DescribeEffectivePolicy.js";
export const DescribeEffectivePolicyHttp = Layer.effect(DescribeEffectivePolicy, makeOrganizationsHttpBinding({
    capability: "DescribeEffectivePolicy",
    iamActions: ["organizations:DescribeEffectivePolicy"],
    operation: organizations.describeEffectivePolicy,
}));
//# sourceMappingURL=DescribeEffectivePolicyHttp.js.map