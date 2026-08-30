import * as repostspace from "@distilled.cloud/aws/repostspace";
import * as Layer from "effect/Layer";
import { BatchAddRole } from "./BatchAddRole.js";
import { makeRePostSpaceHttpBinding } from "./BindingHttp.js";
export const BatchAddRoleHttp = Layer.effect(BatchAddRole, makeRePostSpaceHttpBinding({
    tag: "AWS.RePostSpace.BatchAddRole",
    operation: repostspace.batchAddRole,
    actions: ["repostspace:BatchAddRole"],
}));
//# sourceMappingURL=BatchAddRoleHttp.js.map