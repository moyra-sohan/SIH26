import * as licensemanager from "@distilled.cloud/aws/license-manager";
import * as Layer from "effect/Layer";
import { makeLicenseManagerHttpBinding } from "./BindingHttp.js";
import { CreateGrant } from "./CreateGrant.js";
export const CreateGrantHttp = Layer.effect(CreateGrant, makeLicenseManagerHttpBinding({
    capability: "CreateGrant",
    iamActions: ["license-manager:CreateGrant"],
    operation: licensemanager.createGrant,
}));
//# sourceMappingURL=CreateGrantHttp.js.map