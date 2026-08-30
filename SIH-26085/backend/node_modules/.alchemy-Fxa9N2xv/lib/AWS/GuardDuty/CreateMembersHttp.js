import * as guardduty from "@distilled.cloud/aws/guardduty";
import * as Layer from "effect/Layer";
import { makeGuardDutyDetectorHttpBinding } from "./BindingHttp.js";
import { CreateMembers } from "./CreateMembers.js";
export const CreateMembersHttp = Layer.effect(CreateMembers, makeGuardDutyDetectorHttpBinding({
    tag: "AWS.GuardDuty.CreateMembers",
    operation: guardduty.createMembers,
    actions: ["guardduty:CreateMembers"],
}));
//# sourceMappingURL=CreateMembersHttp.js.map