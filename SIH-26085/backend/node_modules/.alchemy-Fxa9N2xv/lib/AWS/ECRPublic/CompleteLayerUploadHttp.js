import * as ecrpublic from "@distilled.cloud/aws/ecr-public";
import * as Layer from "effect/Layer";
import { makePublicRepositoryHttpBinding } from "./BindingHttp.js";
import { CompleteLayerUpload } from "./CompleteLayerUpload.js";
export const CompleteLayerUploadHttp = Layer.effect(CompleteLayerUpload, makePublicRepositoryHttpBinding({
    capability: "CompleteLayerUpload",
    iamActions: ["ecr-public:CompleteLayerUpload"],
    operation: ecrpublic.completeLayerUpload,
}));
//# sourceMappingURL=CompleteLayerUploadHttp.js.map