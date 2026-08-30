import * as securityhub from "@distilled.cloud/aws/securityhub";
import * as Layer from "effect/Layer";
import { makeSecurityHubHttpBinding } from "./BindingHttp.js";
import { CreateMembers } from "./CreateMembers.js";
export const CreateMembersHttp = Layer.effect(CreateMembers, makeSecurityHubHttpBinding({
    tag: "AWS.SecurityHub.CreateMembers",
    operation: securityhub.createMembers,
    actions: ["securityhub:CreateMembers"],
}));
//# sourceMappingURL=CreateMembersHttp.js.map