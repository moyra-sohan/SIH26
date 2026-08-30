import * as ecr from "@distilled.cloud/aws/ecr";
import * as Layer from "effect/Layer";
import { makeEcrRepositoryHttpBinding } from "./BindingHttp.js";
import { CompleteLayerUpload } from "./CompleteLayerUpload.js";
/** HTTP implementation of {@link CompleteLayerUpload} over the ECR API. */
export const CompleteLayerUploadHttp = Layer.effect(CompleteLayerUpload, makeEcrRepositoryHttpBinding({
    capability: "CompleteLayerUpload",
    operation: ecr.completeLayerUpload,
    iamActions: ["ecr:CompleteLayerUpload"],
}));
//# sourceMappingURL=CompleteLayerUploadHttp.js.map