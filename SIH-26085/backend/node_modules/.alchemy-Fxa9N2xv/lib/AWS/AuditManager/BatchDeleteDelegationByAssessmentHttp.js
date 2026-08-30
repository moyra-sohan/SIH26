import * as auditmanager from "@distilled.cloud/aws/auditmanager";
import * as Layer from "effect/Layer";
import { makeAssessmentScopedHttpBinding } from "./BindingHttp.js";
import { BatchDeleteDelegationByAssessment } from "./BatchDeleteDelegationByAssessment.js";
export const BatchDeleteDelegationByAssessmentHttp = Layer.effect(BatchDeleteDelegationByAssessment, makeAssessmentScopedHttpBinding({
    tag: "AWS.AuditManager.BatchDeleteDelegationByAssessment",
    operation: auditmanager.batchDeleteDelegationByAssessment,
    actions: ["auditmanager:BatchDeleteDelegationByAssessment"],
}));
//# sourceMappingURL=BatchDeleteDelegationByAssessmentHttp.js.map