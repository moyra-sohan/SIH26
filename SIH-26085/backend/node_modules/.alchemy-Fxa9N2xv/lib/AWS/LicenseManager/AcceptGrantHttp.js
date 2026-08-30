import * as licensemanager from "@distilled.cloud/aws/license-manager";
import * as Layer from "effect/Layer";
import { makeLicenseManagerHttpBinding } from "./BindingHttp.js";
import { AcceptGrant } from "./AcceptGrant.js";
export const AcceptGrantHttp = Layer.effect(AcceptGrant, makeLicenseManagerHttpBinding({
    capability: "AcceptGrant",
    iamActions: ["license-manager:AcceptGrant"],
    operation: licensemanager.acceptGrant,
}));
//# sourceMappingURL=AcceptGrantHttp.js.map