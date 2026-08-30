import * as acm from "@distilled.cloud/aws/acm";
import * as Layer from "effect/Layer";
import { makeAcmCertificateHttpBinding } from "./BindingHttp.js";
import { DescribeCertificate } from "./DescribeCertificate.js";
export const DescribeCertificateHttp = Layer.effect(DescribeCertificate, makeAcmCertificateHttpBinding({
    capability: "DescribeCertificate",
    iamActions: ["acm:DescribeCertificate"],
    operation: acm.describeCertificate,
}));
//# sourceMappingURL=DescribeCertificateHttp.js.map