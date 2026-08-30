import * as fms from "@distilled.cloud/aws/fms";
import * as Layer from "effect/Layer";
import { makeFmsHttpBinding } from "./BindingHttp.js";
import { DeleteNotificationChannel } from "./DeleteNotificationChannel.js";
export const DeleteNotificationChannelHttp = Layer.effect(DeleteNotificationChannel, makeFmsHttpBinding({
    capability: "DeleteNotificationChannel",
    iamActions: ["fms:DeleteNotificationChannel"],
    operation: fms.deleteNotificationChannel,
}));
//# sourceMappingURL=DeleteNotificationChannelHttp.js.map