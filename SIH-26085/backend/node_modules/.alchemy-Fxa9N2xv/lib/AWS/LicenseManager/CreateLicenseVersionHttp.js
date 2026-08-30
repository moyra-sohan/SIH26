import * as licensemanager from "@distilled.cloud/aws/license-manager";
import * as Layer from "effect/Layer";
import { makeLicenseManagerHttpBinding } from "./BindingHttp.js";
import { CreateLicenseVersion } from "./CreateLicenseVersion.js";
export const CreateLicenseVersionHttp = Layer.effect(CreateLicenseVersion, makeLicenseManagerHttpBinding({
    capability: "CreateLicenseVersion",
    iamActions: ["license-manager:CreateLicenseVersion"],
    operation: licensemanager.createLicenseVersion,
}));
//# sourceMappingURL=CreateLicenseVersionHttp.js.map