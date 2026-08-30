import * as grafana from "@distilled.cloud/aws/grafana";
import * as Layer from "effect/Layer";
import { AssociateLicense } from "./AssociateLicense.js";
import { makeGrafanaWorkspaceHttpBinding } from "./BindingHttp.js";
export const AssociateLicenseHttp = Layer.effect(AssociateLicense, makeGrafanaWorkspaceHttpBinding({
    tag: "AWS.Grafana.AssociateLicense",
    operation: grafana.associateLicense,
    actions: ["grafana:AssociateLicense"],
}));
//# sourceMappingURL=AssociateLicenseHttp.js.map