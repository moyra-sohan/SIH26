import * as licensemanager from "@distilled.cloud/aws/license-manager";
import * as Layer from "effect/Layer";
import { makeLicenseManagerHttpBinding } from "./BindingHttp.js";
import { CheckoutBorrowLicense } from "./CheckoutBorrowLicense.js";
export const CheckoutBorrowLicenseHttp = Layer.effect(CheckoutBorrowLicense, makeLicenseManagerHttpBinding({
    capability: "CheckoutBorrowLicense",
    iamActions: ["license-manager:CheckoutBorrowLicense"],
    operation: licensemanager.checkoutBorrowLicense,
}));
//# sourceMappingURL=CheckoutBorrowLicenseHttp.js.map