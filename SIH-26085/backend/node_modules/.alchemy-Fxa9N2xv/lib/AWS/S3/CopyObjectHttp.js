import * as S3 from "@distilled.cloud/aws/s3";
import * as Layer from "effect/Layer";
import { makeBucketHttpBinding } from "./BindingHttp.js";
import { CopyObject } from "./CopyObject.js";
export const CopyObjectHttp = Layer.effect(CopyObject, makeBucketHttpBinding({
    tag: "AWS.S3.CopyObject",
    operation: S3.copyObject,
    actions: ["s3:PutObject", "s3:GetObject"],
}));
//# sourceMappingURL=CopyObjectHttp.js.map