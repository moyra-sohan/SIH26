import * as incidents from "@distilled.cloud/aws/ssm-incidents";
import * as Layer from "effect/Layer";
import { makeIncidentsAccountHttpBinding } from "./BindingHttp.js";
import { DeleteIncidentRecord } from "./DeleteIncidentRecord.js";
export const DeleteIncidentRecordHttp = Layer.effect(DeleteIncidentRecord, makeIncidentsAccountHttpBinding({
    tag: "AWS.SSMIncidents.DeleteIncidentRecord",
    operation: incidents.deleteIncidentRecord,
    actions: ["ssm-incidents:DeleteIncidentRecord"],
}));
//# sourceMappingURL=DeleteIncidentRecordHttp.js.map