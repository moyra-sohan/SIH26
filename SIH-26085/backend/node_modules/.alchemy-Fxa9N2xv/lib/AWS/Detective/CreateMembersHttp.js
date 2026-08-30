import * as detective from "@distilled.cloud/aws/detective";
import * as Layer from "effect/Layer";
import { makeDetectiveGraphHttpBinding } from "./BindingHttp.js";
import { CreateMembers } from "./CreateMembers.js";
export const CreateMembersHttp = Layer.effect(CreateMembers, makeDetectiveGraphHttpBinding({
    tag: "AWS.Detective.CreateMembers",
    operation: detective.createMembers,
    actions: ["detective:CreateMembers"],
}));
//# sourceMappingURL=CreateMembersHttp.js.map