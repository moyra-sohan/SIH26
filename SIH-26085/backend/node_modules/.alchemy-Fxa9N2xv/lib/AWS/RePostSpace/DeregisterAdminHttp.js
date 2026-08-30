import * as repostspace from "@distilled.cloud/aws/repostspace";
import * as Layer from "effect/Layer";
import { makeRePostSpaceHttpBinding } from "./BindingHttp.js";
import { DeregisterAdmin } from "./DeregisterAdmin.js";
export const DeregisterAdminHttp = Layer.effect(DeregisterAdmin, makeRePostSpaceHttpBinding({
    tag: "AWS.RePostSpace.DeregisterAdmin",
    operation: repostspace.deregisterAdmin,
    actions: ["repostspace:DeregisterAdmin"],
}));
//# sourceMappingURL=DeregisterAdminHttp.js.map