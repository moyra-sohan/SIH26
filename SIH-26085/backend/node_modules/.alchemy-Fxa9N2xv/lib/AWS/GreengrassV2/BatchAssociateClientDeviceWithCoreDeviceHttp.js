import * as greengrassv2 from "@distilled.cloud/aws/greengrassv2";
import * as Layer from "effect/Layer";
import { makeGreengrassAccountHttpBinding } from "./BindingHttp.js";
import { BatchAssociateClientDeviceWithCoreDevice } from "./BatchAssociateClientDeviceWithCoreDevice.js";
export const BatchAssociateClientDeviceWithCoreDeviceHttp = Layer.effect(BatchAssociateClientDeviceWithCoreDevice, makeGreengrassAccountHttpBinding({
    tag: "AWS.GreengrassV2.BatchAssociateClientDeviceWithCoreDevice",
    operation: greengrassv2.batchAssociateClientDeviceWithCoreDevice,
    actions: ["greengrass:BatchAssociateClientDeviceWithCoreDevice"],
}));
//# sourceMappingURL=BatchAssociateClientDeviceWithCoreDeviceHttp.js.map