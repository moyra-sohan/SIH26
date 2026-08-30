import * as licensemanager from "@distilled.cloud/aws/license-manager";
import * as Layer from "effect/Layer";
import { makeLicenseManagerHttpBinding } from "./BindingHttp.js";
import { DeleteLicense } from "./DeleteLicense.js";
export const DeleteLicenseHttp = Layer.effect(DeleteLicense, makeLicenseManagerHttpBinding({
    capability: "DeleteLicense",
    iamActions: ["license-manager:DeleteLicense"],
    operation: licensemanager.deleteLicense,
}));
//# sourceMappingURL=DeleteLicenseHttp.js.map