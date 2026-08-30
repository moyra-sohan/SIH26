import * as detective from "@distilled.cloud/aws/detective";
import * as Layer from "effect/Layer";
import { makeDetectiveGraphHttpBinding } from "./BindingHttp.js";
import { DeleteMembers } from "./DeleteMembers.js";
export const DeleteMembersHttp = Layer.effect(DeleteMembers, makeDetectiveGraphHttpBinding({
    tag: "AWS.Detective.DeleteMembers",
    operation: detective.deleteMembers,
    actions: ["detective:DeleteMembers"],
}));
//# sourceMappingURL=DeleteMembersHttp.js.map