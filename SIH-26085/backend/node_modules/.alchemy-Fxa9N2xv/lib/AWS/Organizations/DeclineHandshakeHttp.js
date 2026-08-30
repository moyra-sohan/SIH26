import * as organizations from "@distilled.cloud/aws/organizations";
import * as Layer from "effect/Layer";
import { makeOrganizationsHttpBinding } from "./BindingHttp.js";
import { DeclineHandshake } from "./DeclineHandshake.js";
export const DeclineHandshakeHttp = Layer.effect(DeclineHandshake, makeOrganizationsHttpBinding({
    capability: "DeclineHandshake",
    iamActions: ["organizations:DeclineHandshake"],
    operation: organizations.declineHandshake,
}));
//# sourceMappingURL=DeclineHandshakeHttp.js.map