import * as kendra from "@distilled.cloud/aws/kendra";
import * as Layer from "effect/Layer";
import { makeKendraIndexHttpBinding } from "./BindingHttp.js";
import { DeleteAccessControlConfiguration } from "./DeleteAccessControlConfiguration.js";
export const DeleteAccessControlConfigurationHttp = Layer.effect(DeleteAccessControlConfiguration, makeKendraIndexHttpBinding({
    tag: "AWS.Kendra.DeleteAccessControlConfiguration",
    operation: kendra.deleteAccessControlConfiguration,
    actions: ["kendra:DeleteAccessControlConfiguration"],
    subResources: ["access-control-configuration/*"],
}));
//# sourceMappingURL=DeleteAccessControlConfigurationHttp.js.map