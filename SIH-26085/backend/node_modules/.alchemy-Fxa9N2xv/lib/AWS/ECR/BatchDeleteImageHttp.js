import * as ecr from "@distilled.cloud/aws/ecr";
import * as Layer from "effect/Layer";
import { makeEcrRepositoryHttpBinding } from "./BindingHttp.js";
import { BatchDeleteImage } from "./BatchDeleteImage.js";
/** HTTP implementation of {@link BatchDeleteImage} over the ECR API. */
export const BatchDeleteImageHttp = Layer.effect(BatchDeleteImage, makeEcrRepositoryHttpBinding({
    capability: "BatchDeleteImage",
    operation: ecr.batchDeleteImage,
    iamActions: ["ecr:BatchDeleteImage"],
}));
//# sourceMappingURL=BatchDeleteImageHttp.js.map