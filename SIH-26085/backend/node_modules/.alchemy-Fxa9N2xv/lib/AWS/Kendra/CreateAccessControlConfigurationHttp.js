import * as kendra from "@distilled.cloud/aws/kendra";
import * as Layer from "effect/Layer";
import { makeKendraIndexHttpBinding } from "./BindingHttp.js";
import { CreateAccessControlConfiguration } from "./CreateAccessControlConfiguration.js";
export const CreateAccessControlConfigurationHttp = Layer.effect(CreateAccessControlConfiguration, makeKendraIndexHttpBinding({
    tag: "AWS.Kendra.CreateAccessControlConfiguration",
    operation: kendra.createAccessControlConfiguration,
    actions: ["kendra:CreateAccessControlConfiguration"],
    subResources: ["access-control-configuration/*"],
}));
//# sourceMappingURL=CreateAccessControlConfigurationHttp.js.map