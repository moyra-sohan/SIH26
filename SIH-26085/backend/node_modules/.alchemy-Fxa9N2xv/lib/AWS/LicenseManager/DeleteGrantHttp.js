import * as licensemanager from "@distilled.cloud/aws/license-manager";
import * as Layer from "effect/Layer";
import { makeLicenseManagerHttpBinding } from "./BindingHttp.js";
import { DeleteGrant } from "./DeleteGrant.js";
export const DeleteGrantHttp = Layer.effect(DeleteGrant, makeLicenseManagerHttpBinding({
    capability: "DeleteGrant",
    iamActions: ["license-manager:DeleteGrant"],
    operation: licensemanager.deleteGrant,
}));
//# sourceMappingURL=DeleteGrantHttp.js.map