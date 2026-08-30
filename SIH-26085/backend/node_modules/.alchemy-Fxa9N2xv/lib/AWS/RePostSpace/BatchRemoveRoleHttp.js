import * as repostspace from "@distilled.cloud/aws/repostspace";
import * as Layer from "effect/Layer";
import { BatchRemoveRole } from "./BatchRemoveRole.js";
import { makeRePostSpaceHttpBinding } from "./BindingHttp.js";
export const BatchRemoveRoleHttp = Layer.effect(BatchRemoveRole, makeRePostSpaceHttpBinding({
    tag: "AWS.RePostSpace.BatchRemoveRole",
    operation: repostspace.batchRemoveRole,
    actions: ["repostspace:BatchRemoveRole"],
}));
//# sourceMappingURL=BatchRemoveRoleHttp.js.map