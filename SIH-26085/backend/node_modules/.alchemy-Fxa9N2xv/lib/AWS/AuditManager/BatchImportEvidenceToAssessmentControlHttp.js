import * as auditmanager from "@distilled.cloud/aws/auditmanager";
import * as Layer from "effect/Layer";
import { makeAssessmentScopedHttpBinding } from "./BindingHttp.js";
import { BatchImportEvidenceToAssessmentControl } from "./BatchImportEvidenceToAssessmentControl.js";
export const BatchImportEvidenceToAssessmentControlHttp = Layer.effect(BatchImportEvidenceToAssessmentControl, makeAssessmentScopedHttpBinding({
    tag: "AWS.AuditManager.BatchImportEvidenceToAssessmentControl",
    operation: auditmanager.batchImportEvidenceToAssessmentControl,
    actions: ["auditmanager:BatchImportEvidenceToAssessmentControl"],
}));
//# sourceMappingURL=BatchImportEvidenceToAssessmentControlHttp.js.map