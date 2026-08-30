import * as sns from "@distilled.cloud/aws/sns";
import * as Layer from "effect/Layer";
import { makeSnsTopicHttpBinding } from "./BindingHttp.js";
import { AddPermission } from "./AddPermission.js";
export const AddPermissionHttp = Layer.effect(AddPermission, makeSnsTopicHttpBinding({
    tag: "AWS.SNS.AddPermission",
    operation: sns.addPermission,
    actions: ["sns:AddPermission"],
    key: "TopicArn",
}));
//# sourceMappingURL=AddPermissionHttp.js.map