import * as ecrpublic from "@distilled.cloud/aws/ecr-public";
import * as Layer from "effect/Layer";
import { BatchDeleteImage } from "./BatchDeleteImage.js";
import { makePublicRepositoryHttpBinding } from "./BindingHttp.js";
export const BatchDeleteImageHttp = Layer.effect(BatchDeleteImage, makePublicRepositoryHttpBinding({
    capability: "BatchDeleteImage",
    iamActions: ["ecr-public:BatchDeleteImage"],
    operation: ecrpublic.batchDeleteImage,
}));
//# sourceMappingURL=BatchDeleteImageHttp.js.map