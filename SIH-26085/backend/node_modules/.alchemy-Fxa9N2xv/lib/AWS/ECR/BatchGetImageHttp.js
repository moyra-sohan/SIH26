import * as ecr from "@distilled.cloud/aws/ecr";
import * as Layer from "effect/Layer";
import { makeEcrRepositoryHttpBinding } from "./BindingHttp.js";
import { BatchGetImage } from "./BatchGetImage.js";
/** HTTP implementation of {@link BatchGetImage} over the ECR API. */
export const BatchGetImageHttp = Layer.effect(BatchGetImage, makeEcrRepositoryHttpBinding({
    capability: "BatchGetImage",
    operation: ecr.batchGetImage,
    iamActions: ["ecr:BatchGetImage"],
}));
//# sourceMappingURL=BatchGetImageHttp.js.map