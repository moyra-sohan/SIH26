import * as licensemanager from "@distilled.cloud/aws/license-manager";
import * as Layer from "effect/Layer";
import { makeLicenseManagerHttpBinding } from "./BindingHttp.js";
import { CheckInLicense } from "./CheckInLicense.js";
export const CheckInLicenseHttp = Layer.effect(CheckInLicense, makeLicenseManagerHttpBinding({
    capability: "CheckInLicense",
    iamActions: ["license-manager:CheckInLicense"],
    operation: licensemanager.checkInLicense,
}));
//# sourceMappingURL=CheckInLicenseHttp.js.map