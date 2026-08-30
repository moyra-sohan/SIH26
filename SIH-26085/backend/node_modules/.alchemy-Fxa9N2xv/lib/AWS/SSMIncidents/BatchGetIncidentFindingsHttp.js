import * as incidents from "@distilled.cloud/aws/ssm-incidents";
import * as Layer from "effect/Layer";
import { makeIncidentsAccountHttpBinding } from "./BindingHttp.js";
import { BatchGetIncidentFindings } from "./BatchGetIncidentFindings.js";
export const BatchGetIncidentFindingsHttp = Layer.effect(BatchGetIncidentFindings, makeIncidentsAccountHttpBinding({
    tag: "AWS.SSMIncidents.BatchGetIncidentFindings",
    operation: incidents.batchGetIncidentFindings,
    actions: ["ssm-incidents:BatchGetIncidentFindings"],
}));
//# sourceMappingURL=BatchGetIncidentFindingsHttp.js.map