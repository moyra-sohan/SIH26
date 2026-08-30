import * as kms from "@distilled.cloud/aws/kms";
import * as Layer from "effect/Layer";
import { makeKmsKeyHttpBinding } from "./BindingHttp.js";
import { DescribeKey } from "./DescribeKey.js";
export const DescribeKeyHttp = Layer.effect(DescribeKey, makeKmsKeyHttpBinding({
    tag: "AWS.KMS.DescribeKey",
    operation: kms.describeKey,
    actions: ["kms:DescribeKey"],
}));
//# sourceMappingURL=DescribeKeyHttp.js.map