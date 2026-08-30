import * as grafana from "@distilled.cloud/aws/grafana";
import * as Layer from "effect/Layer";
import { makeGrafanaWorkspaceHttpBinding } from "./BindingHttp.js";
import { DeleteWorkspaceServiceAccountToken } from "./DeleteWorkspaceServiceAccountToken.js";
export const DeleteWorkspaceServiceAccountTokenHttp = Layer.effect(DeleteWorkspaceServiceAccountToken, makeGrafanaWorkspaceHttpBinding({
    tag: "AWS.Grafana.DeleteWorkspaceServiceAccountToken",
    operation: grafana.deleteWorkspaceServiceAccountToken,
    actions: ["grafana:DeleteWorkspaceServiceAccountToken"],
}));
//# sourceMappingURL=DeleteWorkspaceServiceAccountTokenHttp.js.map