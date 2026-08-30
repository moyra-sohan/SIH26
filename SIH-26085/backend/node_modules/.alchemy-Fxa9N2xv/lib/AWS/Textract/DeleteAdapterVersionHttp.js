import * as textract from "@distilled.cloud/aws/textract";
import * as Layer from "effect/Layer";
import { makeTextractAdapterHttpBinding } from "./BindingHttp.js";
import { DeleteAdapterVersion } from "./DeleteAdapterVersion.js";
export const DeleteAdapterVersionHttp = Layer.effect(DeleteAdapterVersion, makeTextractAdapterHttpBinding({
    capability: "DeleteAdapterVersion",
    iamActions: ["textract:DeleteAdapterVersion"],
    operation: textract.deleteAdapterVersion,
}));
//# sourceMappingURL=DeleteAdapterVersionHttp.js.map