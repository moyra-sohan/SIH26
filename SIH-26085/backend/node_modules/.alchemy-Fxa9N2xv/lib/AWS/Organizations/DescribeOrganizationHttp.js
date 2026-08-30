import * as organizations from "@distilled.cloud/aws/organizations";
import * as Layer from "effect/Layer";
import { makeOrganizationsHttpBinding } from "./BindingHttp.js";
import { DescribeOrganization } from "./DescribeOrganization.js";
export const DescribeOrganizationHttp = Layer.effect(DescribeOrganization, makeOrganizationsHttpBinding({
    capability: "DescribeOrganization",
    iamActions: ["organizations:DescribeOrganization"],
    operation: organizations.describeOrganization,
}));
//# sourceMappingURL=DescribeOrganizationHttp.js.map