import * as licensemanager from "@distilled.cloud/aws/license-manager";
import * as Layer from "effect/Layer";
import { makeLicenseManagerHttpBinding } from "./BindingHttp.js";
import { CreateToken } from "./CreateToken.js";
export const CreateTokenHttp = Layer.effect(CreateToken, makeLicenseManagerHttpBinding({
    capability: "CreateToken",
    iamActions: ["license-manager:CreateToken"],
    operation: licensemanager.createToken,
}));
//# sourceMappingURL=CreateTokenHttp.js.map