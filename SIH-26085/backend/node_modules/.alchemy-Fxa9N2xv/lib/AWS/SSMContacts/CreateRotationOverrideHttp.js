import * as ssm from "@distilled.cloud/aws/ssm-contacts";
import * as Layer from "effect/Layer";
import { makeRotationHttpBinding } from "./BindingHttp.js";
import { CreateRotationOverride } from "./CreateRotationOverride.js";
export const CreateRotationOverrideHttp = Layer.effect(CreateRotationOverride, makeRotationHttpBinding({
    tag: "AWS.SSMContacts.CreateRotationOverride",
    operation: ssm.createRotationOverride,
    actions: ["ssm-contacts:CreateRotationOverride"],
}));
//# sourceMappingURL=CreateRotationOverrideHttp.js.map