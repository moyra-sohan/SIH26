import * as licensemanager from "@distilled.cloud/aws/license-manager";
import * as Layer from "effect/Layer";
import { makeLicenseManagerHttpBinding } from "./BindingHttp.js";
import { CreateLicense } from "./CreateLicense.js";
export const CreateLicenseHttp = Layer.effect(CreateLicense, makeLicenseManagerHttpBinding({
    capability: "CreateLicense",
    iamActions: ["license-manager:CreateLicense"],
    operation: licensemanager.createLicense,
}));
//# sourceMappingURL=CreateLicenseHttp.js.map