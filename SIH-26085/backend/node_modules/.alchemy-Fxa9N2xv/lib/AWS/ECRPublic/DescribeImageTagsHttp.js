import * as ecrpublic from "@distilled.cloud/aws/ecr-public";
import * as Layer from "effect/Layer";
import { makePublicRepositoryHttpBinding } from "./BindingHttp.js";
import { DescribeImageTags } from "./DescribeImageTags.js";
export const DescribeImageTagsHttp = Layer.effect(DescribeImageTags, makePublicRepositoryHttpBinding({
    capability: "DescribeImageTags",
    iamActions: ["ecr-public:DescribeImageTags"],
    operation: ecrpublic.describeImageTags,
}));
//# sourceMappingURL=DescribeImageTagsHttp.js.map