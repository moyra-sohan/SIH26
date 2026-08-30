import * as securityhub from "@distilled.cloud/aws/securityhub";
import * as Layer from "effect/Layer";
import { makeSecurityHubHttpBinding } from "./BindingHttp.js";
import { BatchGetStandardsControlAssociations } from "./BatchGetStandardsControlAssociations.js";
export const BatchGetStandardsControlAssociationsHttp = Layer.effect(BatchGetStandardsControlAssociations, makeSecurityHubHttpBinding({
    tag: "AWS.SecurityHub.BatchGetStandardsControlAssociations",
    operation: securityhub.batchGetStandardsControlAssociations,
    actions: ["securityhub:BatchGetStandardsControlAssociations"],
}));
//# sourceMappingURL=BatchGetStandardsControlAssociationsHttp.js.map