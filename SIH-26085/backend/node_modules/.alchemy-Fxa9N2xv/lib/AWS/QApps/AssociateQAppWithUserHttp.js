import * as qapps from "@distilled.cloud/aws/qapps";
import * as Layer from "effect/Layer";
import { makeQAppHttpBinding } from "./BindingHttp.js";
import { AssociateQAppWithUser } from "./AssociateQAppWithUser.js";
export const AssociateQAppWithUserHttp = Layer.effect(AssociateQAppWithUser, makeQAppHttpBinding({
    capability: "AssociateQAppWithUser",
    iamActions: ["qapps:AssociateQAppWithUser"],
    operation: qapps.associateQAppWithUser,
    injectAppId: true,
}));
//# sourceMappingURL=AssociateQAppWithUserHttp.js.map