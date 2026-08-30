import * as iotw from "@distilled.cloud/aws/iot-wireless";
import * as Layer from "effect/Layer";
import { makeIotWirelessDeviceHttpBinding } from "./BindingHttp.js";
import { DeleteQueuedMessages, } from "./DeleteQueuedMessages.js";
export const DeleteQueuedMessagesHttp = Layer.effect(DeleteQueuedMessages, makeIotWirelessDeviceHttpBinding({
    capability: "DeleteQueuedMessages",
    iamActions: ["iotwireless:DeleteQueuedMessages"],
    operation: iotw.deleteQueuedMessages,
    prepare: (request, wirelessDeviceId) => ({
        ...request,
        Id: wirelessDeviceId,
    }),
}));
//# sourceMappingURL=DeleteQueuedMessagesHttp.js.map