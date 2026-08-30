import * as finspace from "@distilled.cloud/aws/finspace";
import * as Layer from "effect/Layer";
import { makeFinSpaceKxHttpBinding } from "./BindingHttp.js";
import { DeleteKxUser } from "./DeleteKxUser.js";
export const DeleteKxUserHttp = Layer.effect(DeleteKxUser, makeFinSpaceKxHttpBinding({
    tag: "AWS.FinSpace.DeleteKxUser",
    operation: finspace.deleteKxUser,
    actions: ["finspace:DeleteKxUser"],
}));
//# sourceMappingURL=DeleteKxUserHttp.js.map