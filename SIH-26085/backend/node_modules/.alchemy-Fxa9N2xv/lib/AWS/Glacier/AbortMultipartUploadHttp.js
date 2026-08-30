import * as glacier from "@distilled.cloud/aws/glacier";
import * as Layer from "effect/Layer";
import { makeGlacierVaultHttpBinding } from "./BindingHttp.js";
import { AbortMultipartUpload } from "./AbortMultipartUpload.js";
export const AbortMultipartUploadHttp = Layer.effect(AbortMultipartUpload, makeGlacierVaultHttpBinding({
    tag: "AWS.Glacier.AbortMultipartUpload",
    operation: glacier.abortMultipartUpload,
    actions: ["glacier:AbortMultipartUpload"],
}));
//# sourceMappingURL=AbortMultipartUploadHttp.js.map