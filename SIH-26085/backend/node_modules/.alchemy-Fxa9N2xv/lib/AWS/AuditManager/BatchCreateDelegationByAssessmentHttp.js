import * as auditmanager from "@distilled.cloud/aws/auditmanager";
import * as Layer from "effect/Layer";
import { makeAssessmentScopedHttpBinding } from "./BindingHttp.js";
import { BatchCreateDelegationByAssessment } from "./BatchCreateDelegationByAssessment.js";
export const BatchCreateDelegationByAssessmentHttp = Layer.effect(BatchCreateDelegationByAssessment, makeAssessmentScopedHttpBinding({
    tag: "AWS.AuditManager.BatchCreateDelegationByAssessment",
    operation: auditmanager.batchCreateDelegationByAssessment,
    actions: ["auditmanager:BatchCreateDelegationByAssessment"],
}));
//# sourceMappingURL=BatchCreateDelegationByAssessmentHttp.js.map