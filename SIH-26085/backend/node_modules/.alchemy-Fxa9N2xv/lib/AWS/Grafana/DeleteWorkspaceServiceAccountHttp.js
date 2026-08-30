import * as grafana from "@distilled.cloud/aws/grafana";
import * as Layer from "effect/Layer";
import { makeGrafanaWorkspaceHttpBinding } from "./BindingHttp.js";
import { DeleteWorkspaceServiceAccount } from "./DeleteWorkspaceServiceAccount.js";
export const DeleteWorkspaceServiceAccountHttp = Layer.effect(DeleteWorkspaceServiceAccount, makeGrafanaWorkspaceHttpBinding({
    tag: "AWS.Grafana.DeleteWorkspaceServiceAccount",
    operation: grafana.deleteWorkspaceServiceAccount,
    actions: ["grafana:DeleteWorkspaceServiceAccount"],
}));
//# sourceMappingURL=DeleteWorkspaceServiceAccountHttp.js.map