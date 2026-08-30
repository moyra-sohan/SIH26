import * as acmpca from "@distilled.cloud/aws/acm-pca";
import * as Layer from "effect/Layer";
import { makeACMPCAHttpBinding } from "./BindingHttp.js";
import { DescribeCertificateAuthorityAuditReport } from "./DescribeCertificateAuthorityAuditReport.js";
export const DescribeCertificateAuthorityAuditReportHttp = Layer.effect(DescribeCertificateAuthorityAuditReport, makeACMPCAHttpBinding({
    action: "DescribeCertificateAuthorityAuditReport",
    operation: acmpca.describeCertificateAuthorityAuditReport,
}));
//# sourceMappingURL=DescribeCertificateAuthorityAuditReportHttp.js.map