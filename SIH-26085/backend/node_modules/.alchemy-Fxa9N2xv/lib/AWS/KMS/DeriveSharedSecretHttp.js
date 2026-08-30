import * as kms from "@distilled.cloud/aws/kms";
import * as Layer from "effect/Layer";
import { makeKmsKeyHttpBinding } from "./BindingHttp.js";
import { DeriveSharedSecret } from "./DeriveSharedSecret.js";
export const DeriveSharedSecretHttp = Layer.effect(DeriveSharedSecret, makeKmsKeyHttpBinding({
    tag: "AWS.KMS.DeriveSharedSecret",
    operation: kms.deriveSharedSecret,
    actions: ["kms:DeriveSharedSecret"],
}));
//# sourceMappingURL=DeriveSharedSecretHttp.js.map