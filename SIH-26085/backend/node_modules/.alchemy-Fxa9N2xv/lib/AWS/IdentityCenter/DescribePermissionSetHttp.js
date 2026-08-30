import * as ssoAdmin from "@distilled.cloud/aws/sso-admin";
import * as Layer from "effect/Layer";
import { makeIdentityCenterInstanceHttpBinding } from "./BindingHttp.js";
import { DescribePermissionSet } from "./DescribePermissionSet.js";
export const DescribePermissionSetHttp = Layer.effect(DescribePermissionSet, makeIdentityCenterInstanceHttpBinding({
    tag: "AWS.IdentityCenter.DescribePermissionSet",
    operation: ssoAdmin.describePermissionSet,
    actions: ["sso:DescribePermissionSet"],
}));
//# sourceMappingURL=DescribePermissionSetHttp.js.map