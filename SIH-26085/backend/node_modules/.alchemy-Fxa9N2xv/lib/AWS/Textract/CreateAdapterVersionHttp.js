import * as textract from "@distilled.cloud/aws/textract";
import * as Layer from "effect/Layer";
import { makeTextractAdapterHttpBinding } from "./BindingHttp.js";
import { CreateAdapterVersion } from "./CreateAdapterVersion.js";
export const CreateAdapterVersionHttp = Layer.effect(CreateAdapterVersion, makeTextractAdapterHttpBinding({
    capability: "CreateAdapterVersion",
    iamActions: ["textract:CreateAdapterVersion"],
    operation: textract.createAdapterVersion,
}));
//# sourceMappingURL=CreateAdapterVersionHttp.js.map