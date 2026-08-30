import * as identitystore from "@distilled.cloud/aws/identitystore";
import * as Layer from "effect/Layer";
import { makeIdentityStoreHttpBinding } from "./BindingHttp.js";
import { DescribeGroupMembership } from "./DescribeGroupMembership.js";
export const DescribeGroupMembershipHttp = Layer.effect(DescribeGroupMembership, makeIdentityStoreHttpBinding({
    tag: "AWS.IdentityCenter.DescribeGroupMembership",
    operation: identitystore.describeGroupMembership,
    actions: ["identitystore:DescribeGroupMembership"],
}));
//# sourceMappingURL=DescribeGroupMembershipHttp.js.map