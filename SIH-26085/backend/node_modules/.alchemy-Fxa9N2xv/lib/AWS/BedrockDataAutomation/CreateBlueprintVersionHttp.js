import * as bda from "@distilled.cloud/aws/bedrock-data-automation";
import * as Layer from "effect/Layer";
import { makeBdaBlueprintHttpBinding } from "./BindingHttp.js";
import { CreateBlueprintVersion } from "./CreateBlueprintVersion.js";
export const CreateBlueprintVersionHttp = Layer.effect(CreateBlueprintVersion, makeBdaBlueprintHttpBinding({
    tag: "AWS.BedrockDataAutomation.CreateBlueprintVersion",
    operation: bda.createBlueprintVersion,
    actions: ["bedrock:CreateBlueprintVersion"],
}));
//# sourceMappingURL=CreateBlueprintVersionHttp.js.map