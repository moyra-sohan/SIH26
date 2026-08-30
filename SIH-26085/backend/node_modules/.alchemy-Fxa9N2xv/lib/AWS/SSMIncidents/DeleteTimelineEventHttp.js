import * as incidents from "@distilled.cloud/aws/ssm-incidents";
import * as Layer from "effect/Layer";
import { makeIncidentsAccountHttpBinding } from "./BindingHttp.js";
import { DeleteTimelineEvent } from "./DeleteTimelineEvent.js";
export const DeleteTimelineEventHttp = Layer.effect(DeleteTimelineEvent, makeIncidentsAccountHttpBinding({
    tag: "AWS.SSMIncidents.DeleteTimelineEvent",
    operation: incidents.deleteTimelineEvent,
    actions: ["ssm-incidents:DeleteTimelineEvent"],
}));
//# sourceMappingURL=DeleteTimelineEventHttp.js.map