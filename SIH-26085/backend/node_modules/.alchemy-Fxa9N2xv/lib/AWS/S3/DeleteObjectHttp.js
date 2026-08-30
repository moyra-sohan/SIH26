import * as S3 from "@distilled.cloud/aws/s3";
import * as Layer from "effect/Layer";
import { makeBucketHttpBinding } from "./BindingHttp.js";
import { DeleteObject } from "./DeleteObject.js";
export const DeleteObjectHttp = Layer.effect(DeleteObject, makeBucketHttpBinding({
    tag: "AWS.S3.DeleteObject",
    operation: S3.deleteObject,
    actions: ["s3:DeleteObject", "s3:DeleteObjectVersion"],
}));
//# sourceMappingURL=DeleteObjectHttp.js.map