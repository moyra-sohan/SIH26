import * as personalize from "@distilled.cloud/aws/personalize";
import * as Layer from "effect/Layer";
import { makePersonalizeAccountHttpBinding } from "./BindingHttp.js";
import { CreateSolution } from "./CreateSolution.js";
export const CreateSolutionHttp = Layer.effect(CreateSolution, makePersonalizeAccountHttpBinding({
    tag: "AWS.Personalize.CreateSolution",
    operation: personalize.createSolution,
    actions: ["personalize:CreateSolution"],
}));
//# sourceMappingURL=CreateSolutionHttp.js.map