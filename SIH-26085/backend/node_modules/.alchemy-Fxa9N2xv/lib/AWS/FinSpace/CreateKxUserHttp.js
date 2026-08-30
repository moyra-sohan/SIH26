import * as finspace from "@distilled.cloud/aws/finspace";
import * as Layer from "effect/Layer";
import { makeFinSpaceKxHttpBinding } from "./BindingHttp.js";
import { CreateKxUser } from "./CreateKxUser.js";
export const CreateKxUserHttp = Layer.effect(CreateKxUser, makeFinSpaceKxHttpBinding({
    tag: "AWS.FinSpace.CreateKxUser",
    operation: finspace.createKxUser,
    actions: ["finspace:CreateKxUser"],
}));
//# sourceMappingURL=CreateKxUserHttp.js.map