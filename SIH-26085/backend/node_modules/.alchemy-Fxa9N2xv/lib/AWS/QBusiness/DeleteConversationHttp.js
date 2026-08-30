import * as qbusiness from "@distilled.cloud/aws/qbusiness";
import * as Layer from "effect/Layer";
import { makeQBusinessApplicationHttpBinding } from "./BindingHttp.js";
import { DeleteConversation } from "./DeleteConversation.js";
export const DeleteConversationHttp = Layer.effect(DeleteConversation, makeQBusinessApplicationHttpBinding({
    tag: "AWS.QBusiness.DeleteConversation",
    operation: qbusiness.deleteConversation,
    actions: ["qbusiness:DeleteConversation"],
}));
//# sourceMappingURL=DeleteConversationHttp.js.map