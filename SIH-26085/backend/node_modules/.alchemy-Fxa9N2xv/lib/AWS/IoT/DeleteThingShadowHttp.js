import * as iotdata from "@distilled.cloud/aws/iot-data-plane";
import * as Layer from "effect/Layer";
import { makeIotThingHttpBinding } from "./BindingHttp.js";
import { DeleteThingShadow } from "./DeleteThingShadow.js";
/**
 * HTTP implementation of the {@link DeleteThingShadow} capability — grants
 * `iot:DeleteThingShadow` on the thing ARN and calls the IoT data-plane
 * `DeleteThingShadow` API.
 */
export const DeleteThingShadowHttp = Layer.effect(DeleteThingShadow, makeIotThingHttpBinding({
    tag: "AWS.IoT.DeleteThingShadow",
    operation: iotdata.deleteThingShadow,
    actions: ["iot:DeleteThingShadow"],
}));
//# sourceMappingURL=DeleteThingShadowHttp.js.map