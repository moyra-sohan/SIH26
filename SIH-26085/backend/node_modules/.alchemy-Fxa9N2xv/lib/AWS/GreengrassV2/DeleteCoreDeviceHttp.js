import * as greengrassv2 from "@distilled.cloud/aws/greengrassv2";
import * as Layer from "effect/Layer";
import { makeGreengrassAccountHttpBinding } from "./BindingHttp.js";
import { DeleteCoreDevice } from "./DeleteCoreDevice.js";
export const DeleteCoreDeviceHttp = Layer.effect(DeleteCoreDevice, makeGreengrassAccountHttpBinding({
    tag: "AWS.GreengrassV2.DeleteCoreDevice",
    operation: greengrassv2.deleteCoreDevice,
    // Deleting a core device resolves the device's deployment job executions
    // with the caller's credentials (documented dependent action).
    actions: ["greengrass:DeleteCoreDevice", "iot:DescribeJobExecution"],
}));
//# sourceMappingURL=DeleteCoreDeviceHttp.js.map