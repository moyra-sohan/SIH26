import * as personalize from "@distilled.cloud/aws/personalize";
import * as Layer from "effect/Layer";
import { makePersonalizeAccountHttpBinding } from "./BindingHttp.js";
import { CreateSolutionVersion } from "./CreateSolutionVersion.js";
export const CreateSolutionVersionHttp = Layer.effect(CreateSolutionVersion, makePersonalizeAccountHttpBinding({
    tag: "AWS.Personalize.CreateSolutionVersion",
    operation: personalize.createSolutionVersion,
    actions: ["personalize:CreateSolutionVersion"],
}));
//# sourceMappingURL=CreateSolutionVersionHttp.js.map