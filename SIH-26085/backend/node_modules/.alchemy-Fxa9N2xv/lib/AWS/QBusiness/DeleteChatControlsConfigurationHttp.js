import * as qbusiness from "@distilled.cloud/aws/qbusiness";
import * as Layer from "effect/Layer";
import { makeQBusinessApplicationHttpBinding } from "./BindingHttp.js";
import { DeleteChatControlsConfiguration } from "./DeleteChatControlsConfiguration.js";
export const DeleteChatControlsConfigurationHttp = Layer.effect(DeleteChatControlsConfiguration, makeQBusinessApplicationHttpBinding({
    tag: "AWS.QBusiness.DeleteChatControlsConfiguration",
    operation: qbusiness.deleteChatControlsConfiguration,
    actions: ["qbusiness:DeleteChatControlsConfiguration"],
}));
//# sourceMappingURL=DeleteChatControlsConfigurationHttp.js.map