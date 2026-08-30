import * as ram from "@distilled.cloud/aws/ram";
import * as Layer from "effect/Layer";
import { makeRAMHttpBinding } from "./BindingHttp.js";
import { AcceptResourceShareInvitation } from "./AcceptResourceShareInvitation.js";
export const AcceptResourceShareInvitationHttp = Layer.effect(AcceptResourceShareInvitation, makeRAMHttpBinding({
    capability: "AcceptResourceShareInvitation",
    iamActions: ["ram:AcceptResourceShareInvitation"],
    operation: ram.acceptResourceShareInvitation,
}));
//# sourceMappingURL=AcceptResourceShareInvitationHttp.js.map