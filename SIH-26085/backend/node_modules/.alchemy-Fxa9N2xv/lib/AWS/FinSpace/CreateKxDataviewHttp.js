import * as finspace from "@distilled.cloud/aws/finspace";
import * as Layer from "effect/Layer";
import { makeFinSpaceKxHttpBinding } from "./BindingHttp.js";
import { CreateKxDataview } from "./CreateKxDataview.js";
export const CreateKxDataviewHttp = Layer.effect(CreateKxDataview, makeFinSpaceKxHttpBinding({
    tag: "AWS.FinSpace.CreateKxDataview",
    operation: finspace.createKxDataview,
    actions: ["finspace:CreateKxDataview"],
}));
//# sourceMappingURL=CreateKxDataviewHttp.js.map