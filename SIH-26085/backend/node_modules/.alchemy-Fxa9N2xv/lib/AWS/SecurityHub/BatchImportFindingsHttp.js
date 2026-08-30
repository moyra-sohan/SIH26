import * as securityhub from "@distilled.cloud/aws/securityhub";
import * as Layer from "effect/Layer";
import { makeSecurityHubHttpBinding } from "./BindingHttp.js";
import { BatchImportFindings } from "./BatchImportFindings.js";
export const BatchImportFindingsHttp = Layer.effect(BatchImportFindings, makeSecurityHubHttpBinding({
    tag: "AWS.SecurityHub.BatchImportFindings",
    operation: securityhub.batchImportFindings,
    actions: ["securityhub:BatchImportFindings"],
}));
//# sourceMappingURL=BatchImportFindingsHttp.js.map