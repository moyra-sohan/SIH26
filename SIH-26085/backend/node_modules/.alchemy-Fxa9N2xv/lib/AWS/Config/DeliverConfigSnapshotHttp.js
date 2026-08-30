import * as config from "@distilled.cloud/aws/config-service";
import * as Layer from "effect/Layer";
import { makeConfigResourceHttpBinding } from "./BindingHttp.js";
import { DeliverConfigSnapshot } from "./DeliverConfigSnapshot.js";
export const DeliverConfigSnapshotHttp = Layer.effect(DeliverConfigSnapshot, makeConfigResourceHttpBinding({
    tag: "AWS.Config.DeliverConfigSnapshot",
    operation: config.deliverConfigSnapshot,
    actions: ["config:DeliverConfigSnapshot"],
    requestKey: "deliveryChannelName",
    identifier: (channel) => channel.deliveryChannelName,
}));
//# sourceMappingURL=DeliverConfigSnapshotHttp.js.map