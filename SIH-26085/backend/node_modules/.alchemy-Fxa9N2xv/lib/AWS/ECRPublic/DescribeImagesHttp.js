import * as ecrpublic from "@distilled.cloud/aws/ecr-public";
import * as Layer from "effect/Layer";
import { makePublicRepositoryHttpBinding } from "./BindingHttp.js";
import { DescribeImages } from "./DescribeImages.js";
export const DescribeImagesHttp = Layer.effect(DescribeImages, makePublicRepositoryHttpBinding({
    capability: "DescribeImages",
    iamActions: ["ecr-public:DescribeImages"],
    operation: ecrpublic.describeImages,
}));
//# sourceMappingURL=DescribeImagesHttp.js.map