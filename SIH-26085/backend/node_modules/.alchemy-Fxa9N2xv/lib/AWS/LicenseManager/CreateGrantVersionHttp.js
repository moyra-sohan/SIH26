import * as licensemanager from "@distilled.cloud/aws/license-manager";
import * as Layer from "effect/Layer";
import { makeLicenseManagerHttpBinding } from "./BindingHttp.js";
import { CreateGrantVersion } from "./CreateGrantVersion.js";
export const CreateGrantVersionHttp = Layer.effect(CreateGrantVersion, makeLicenseManagerHttpBinding({
    capability: "CreateGrantVersion",
    iamActions: ["license-manager:CreateGrantVersion"],
    operation: licensemanager.createGrantVersion,
}));
//# sourceMappingURL=CreateGrantVersionHttp.js.map