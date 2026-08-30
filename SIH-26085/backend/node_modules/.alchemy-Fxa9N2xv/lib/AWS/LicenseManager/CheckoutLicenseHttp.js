import * as licensemanager from "@distilled.cloud/aws/license-manager";
import * as Layer from "effect/Layer";
import { makeLicenseManagerHttpBinding } from "./BindingHttp.js";
import { CheckoutLicense } from "./CheckoutLicense.js";
export const CheckoutLicenseHttp = Layer.effect(CheckoutLicense, makeLicenseManagerHttpBinding({
    capability: "CheckoutLicense",
    iamActions: ["license-manager:CheckoutLicense"],
    operation: licensemanager.checkoutLicense,
}));
//# sourceMappingURL=CheckoutLicenseHttp.js.map