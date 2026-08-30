import * as acmpca from "@distilled.cloud/aws/acm-pca";
import * as Layer from "effect/Layer";
import { makeACMPCAHttpBinding } from "./BindingHttp.js";
import { CreateCertificateAuthorityAuditReport } from "./CreateCertificateAuthorityAuditReport.js";
export const CreateCertificateAuthorityAuditReportHttp = Layer.effect(CreateCertificateAuthorityAuditReport, makeACMPCAHttpBinding({
    action: "CreateCertificateAuthorityAuditReport",
    operation: acmpca.createCertificateAuthorityAuditReport,
}));
//# sourceMappingURL=CreateCertificateAuthorityAuditReportHttp.js.map