import * as glacier from "@distilled.cloud/aws/glacier";
import * as Layer from "effect/Layer";
import { makeGlacierVaultHttpBinding } from "./BindingHttp.js";
import { CompleteMultipartUpload } from "./CompleteMultipartUpload.js";
export const CompleteMultipartUploadHttp = Layer.effect(CompleteMultipartUpload, makeGlacierVaultHttpBinding({
    tag: "AWS.Glacier.CompleteMultipartUpload",
    operation: glacier.completeMultipartUpload,
    actions: ["glacier:CompleteMultipartUpload"],
}));
//# sourceMappingURL=CompleteMultipartUploadHttp.js.map