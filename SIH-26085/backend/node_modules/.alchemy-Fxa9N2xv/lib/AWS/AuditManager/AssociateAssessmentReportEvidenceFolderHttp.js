import * as auditmanager from "@distilled.cloud/aws/auditmanager";
import * as Layer from "effect/Layer";
import { makeAssessmentScopedHttpBinding } from "./BindingHttp.js";
import { AssociateAssessmentReportEvidenceFolder } from "./AssociateAssessmentReportEvidenceFolder.js";
export const AssociateAssessmentReportEvidenceFolderHttp = Layer.effect(AssociateAssessmentReportEvidenceFolder, makeAssessmentScopedHttpBinding({
    tag: "AWS.AuditManager.AssociateAssessmentReportEvidenceFolder",
    operation: auditmanager.associateAssessmentReportEvidenceFolder,
    actions: ["auditmanager:AssociateAssessmentReportEvidenceFolder"],
}));
//# sourceMappingURL=AssociateAssessmentReportEvidenceFolderHttp.js.map