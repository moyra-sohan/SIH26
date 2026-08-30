import * as ec2 from "@distilled.cloud/aws/ec2";
import * as Layer from "effect/Layer";
import { AuthorizeSecurityGroupIngress } from "./AuthorizeSecurityGroupIngress.js";
import { makeSecurityGroupHttpBinding } from "./BindingHttp.js";
export const AuthorizeSecurityGroupIngressHttp = Layer.effect(AuthorizeSecurityGroupIngress, makeSecurityGroupHttpBinding({
    tag: "AWS.EC2.AuthorizeSecurityGroupIngress",
    operation: ec2.authorizeSecurityGroupIngress,
    actions: ["ec2:AuthorizeSecurityGroupIngress"],
}));
//# sourceMappingURL=AuthorizeSecurityGroupIngressHttp.js.map