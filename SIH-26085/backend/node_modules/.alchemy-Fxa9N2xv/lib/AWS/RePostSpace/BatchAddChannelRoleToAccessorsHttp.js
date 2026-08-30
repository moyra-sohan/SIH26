import * as repostspace from "@distilled.cloud/aws/repostspace";
import * as Layer from "effect/Layer";
import { BatchAddChannelRoleToAccessors } from "./BatchAddChannelRoleToAccessors.js";
import { makeRePostSpaceHttpBinding } from "./BindingHttp.js";
export const BatchAddChannelRoleToAccessorsHttp = Layer.effect(BatchAddChannelRoleToAccessors, makeRePostSpaceHttpBinding({
    tag: "AWS.RePostSpace.BatchAddChannelRoleToAccessors",
    operation: repostspace.batchAddChannelRoleToAccessors,
    actions: ["repostspace:BatchAddChannelRoleToAccessors"],
}));
//# sourceMappingURL=BatchAddChannelRoleToAccessorsHttp.js.map