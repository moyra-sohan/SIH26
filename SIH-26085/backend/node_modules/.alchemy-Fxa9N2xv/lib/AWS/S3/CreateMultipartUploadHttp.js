import * as S3 from "@distilled.cloud/aws/s3";
import * as Layer from "effect/Layer";
import { makeBucketHttpBinding } from "./BindingHttp.js";
import { CreateMultipartUpload } from "./CreateMultipartUpload.js";
export const CreateMultipartUploadHttp = Layer.effect(CreateMultipartUpload, makeBucketHttpBinding({
    tag: "AWS.S3.CreateMultipartUpload",
    operation: S3.createMultipartUpload,
    actions: ["s3:PutObject"],
}));
//# sourceMappingURL=CreateMultipartUploadHttp.js.map