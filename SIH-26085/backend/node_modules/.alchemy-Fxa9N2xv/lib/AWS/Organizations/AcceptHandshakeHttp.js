import * as organizations from "@distilled.cloud/aws/organizations";
import * as Layer from "effect/Layer";
import { makeOrganizationsHttpBinding } from "./BindingHttp.js";
import { AcceptHandshake } from "./AcceptHandshake.js";
export const AcceptHandshakeHttp = Layer.effect(AcceptHandshake, makeOrganizationsHttpBinding({
    capability: "AcceptHandshake",
    iamActions: ["organizations:AcceptHandshake"],
    operation: organizations.acceptHandshake,
}));
//# sourceMappingURL=AcceptHandshakeHttp.js.map