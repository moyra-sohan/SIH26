import * as greengrassv2 from "@distilled.cloud/aws/greengrassv2";
import * as Layer from "effect/Layer";
import { makeGreengrassAccountHttpBinding } from "./BindingHttp.js";
import { BatchDisassociateClientDeviceFromCoreDevice } from "./BatchDisassociateClientDeviceFromCoreDevice.js";
export const BatchDisassociateClientDeviceFromCoreDeviceHttp = Layer.effect(BatchDisassociateClientDeviceFromCoreDevice, makeGreengrassAccountHttpBinding({
    tag: "AWS.GreengrassV2.BatchDisassociateClientDeviceFromCoreDevice",
    operation: greengrassv2.batchDisassociateClientDeviceFromCoreDevice,
    actions: ["greengrass:BatchDisassociateClientDeviceFromCoreDevice"],
}));
//# sourceMappingURL=BatchDisassociateClientDeviceFromCoreDeviceHttp.js.map