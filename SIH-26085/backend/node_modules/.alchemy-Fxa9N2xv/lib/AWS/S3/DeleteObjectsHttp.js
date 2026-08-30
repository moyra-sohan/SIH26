import * as S3 from "@distilled.cloud/aws/s3";
import * as Layer from "effect/Layer";
import { makeBucketHttpBinding } from "./BindingHttp.js";
import { DeleteObjects } from "./DeleteObjects.js";
export const DeleteObjectsHttp = Layer.effect(DeleteObjects, makeBucketHttpBinding({
    tag: "AWS.S3.DeleteObjects",
    operation: S3.deleteObjects,
    actions: ["s3:DeleteObject", "s3:DeleteObjectVersion"],
}));
//# sourceMappingURL=DeleteObjectsHttp.js.map