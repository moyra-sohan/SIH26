import * as repostspace from "@distilled.cloud/aws/repostspace";
import * as Layer from "effect/Layer";
import { BatchRemoveChannelRoleFromAccessors } from "./BatchRemoveChannelRoleFromAccessors.js";
import { makeRePostSpaceHttpBinding } from "./BindingHttp.js";
export const BatchRemoveChannelRoleFromAccessorsHttp = Layer.effect(BatchRemoveChannelRoleFromAccessors, makeRePostSpaceHttpBinding({
    tag: "AWS.RePostSpace.BatchRemoveChannelRoleFromAccessors",
    operation: repostspace.batchRemoveChannelRoleFromAccessors,
    actions: ["repostspace:BatchRemoveChannelRoleFromAccessors"],
}));
//# sourceMappingURL=BatchRemoveChannelRoleFromAccessorsHttp.js.map