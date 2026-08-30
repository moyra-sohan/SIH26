import * as organizations from "@distilled.cloud/aws/organizations";
import * as Layer from "effect/Layer";
import { makeOrganizationsHttpBinding } from "./BindingHttp.js";
import { CancelHandshake } from "./CancelHandshake.js";
export const CancelHandshakeHttp = Layer.effect(CancelHandshake, makeOrganizationsHttpBinding({
    capability: "CancelHandshake",
    iamActions: ["organizations:CancelHandshake"],
    operation: organizations.cancelHandshake,
}));
//# sourceMappingURL=CancelHandshakeHttp.js.map