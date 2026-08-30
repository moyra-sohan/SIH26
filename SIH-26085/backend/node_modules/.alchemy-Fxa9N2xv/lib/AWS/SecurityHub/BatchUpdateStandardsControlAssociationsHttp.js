import * as securityhub from "@distilled.cloud/aws/securityhub";
import * as Layer from "effect/Layer";
import { makeSecurityHubHttpBinding } from "./BindingHttp.js";
import { BatchUpdateStandardsControlAssociations } from "./BatchUpdateStandardsControlAssociations.js";
export const BatchUpdateStandardsControlAssociationsHttp = Layer.effect(BatchUpdateStandardsControlAssociations, makeSecurityHubHttpBinding({
    tag: "AWS.SecurityHub.BatchUpdateStandardsControlAssociations",
    operation: securityhub.batchUpdateStandardsControlAssociations,
    actions: ["securityhub:BatchUpdateStandardsControlAssociations"],
}));
//# sourceMappingURL=BatchUpdateStandardsControlAssociationsHttp.js.map